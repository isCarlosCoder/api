const express = require('express');
const router = express.Router();
const path = require('path');
const crypto = require('crypto');
const database = require('./func/database');
const jwt = require('jsonwebtoken');
let processR = process.env.use_recaptcha;
processR = processR === 'true';

router.post('/login', async (req, res) => {
    const { mail, password } = req.body;
    if (!mail || !password) {
        return res.status(400).json({ status: false, message: 'Dados ausentes' });
    }
    const unbase64 = Buffer.from(password, 'base64').toString('utf-8');
    const hashPasswd = crypto.createHash('md5').update(unbase64).digest('hex')
    const user = database.getDatabaseByUser(mail, true);
    //console.log(hashPasswd);
    //7console.log(user);
    if (!user) {
        return res.status(404).json({ status: false, message: '[❗] Usuário não encontrado, registre-se.' });
    }
    if (user.hashPassword !== hashPasswd) {
        return res.status(401).json({ status: false, message: '[❗] Senha incorreta, lembre-se que deve ter 8 dígitos ou mais.' });
    }
    if (!user.isVerified) {
        return res.status(401).json({ status: false, message: '[❗] Usuário não verificado, verifique sua caixa de entrada de e-mail ou caixa de spam.' });
    }

    const token = jwt.sign({ mail: mail, userid: user.userId }, process.env.JWT_SECRET || 'B3tterTh@nB');
    res.status(200).json({ status: true, token: token });

});

router.post('/register', async (req, res) => {
    const { mail, password, recaptchaVerify } = req.body;
    if (!mail || !password) {
        return res.status(400).json({ status: false, message: 'Dados ausentes' });
    }

    if (processR && !recaptchaVerify) {
        return res.status(400).json({ status: false, message: 'Falta recaptcha' });
    }

    const user = database.getDatabaseByUser(mail);
    if (user) {
        return res.status(409).json({ status: false, message: '[❗] Usuário já cadastrado, verifique seu e-mail e faça login.' });
    }
    if (processR) {
        const recaptcha = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${process.env.recaptcha_secret}&response=${recaptchaVerify}`, {
            method: 'POST'
        });
        const recaptchaJson = await recaptcha.json();
        if (!recaptchaJson.success) {
            return res.status(400).json({ status: false, message: 'Recaptcha inválido' });
        }
    }
    const unbase64 = Buffer.from(password, 'base64').toString('utf-8');
    const newUser = database.PostDatabase(mail, unbase64, !(process.env.new_user_verification === 'true'));
    if (process.env.new_user_verification === 'true') {
        // send mail
        try {
            //console.log('Enviando correo a ' + mail);
            const info = await mTransporter.sendMail({
                from: process.env.smtp_user,
                to: mail,
                subject: "Verificação de e-mail",
                html: `
                <html>
                <head>
                <style>
                body {
                    font-family: Arial, sans-serif;
                    background-color: #f4f4f4;
                    color: #333;
                    padding: 20px;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #fff;
                    border-radius: 5px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                }
                h1 {
                    color: #007bff;
                    text-align: center;
                }
                p {
                    margin-bottom: 20px;
                }
                a {
                    color: #007bff;
                    text-decoration: none;
                    font-weight: bold;
                }
                .signature {
                    margin-top: 20px;
                    border-top: 1px solid #ccc;
                    padding-top: 10px;
                    text-align: center;
                }
                </style>
                </head>
                <body>
                <div class="container">
                <h1>verificação de e-mail</h1>
                <p>Olá usuário,</p>
                <p>Para completar seu cadastro e poder utilizar nossos serviços API, clique no link a seguir:</p>
                <p><a href="https://${req.headers.host}/api/manageusers/verify?token=${newUser.verifyCode}">Verificar email</a></p>
                <p>Se você não solicitou este e-mail, simplesmente ignore-o.</p>
                <p>¡Obrigado!</p>
                <div class="signature">
                <p><strong>CarlosDlw</strong></p>
                </div>
                </div>
                </body>
                </html>
                `
            });
            //console.log("Message sent: %s", info.messageId);
            return res.status(200).json({ status: true, message: '[❗] Usuário cadastrado, para finalizar o cadastro verifique seu e-mail, caso não veja o e-mail verifique a pasta de spam.' });
        } catch (error) {
            console.log(error);
            database.DeleteDatabase(newUser.mail);
            return res.status(500).json({ status: false, message: '[⚠️] Erro ao enviar e-mail, reporte o erro' });
        }
    }
    return res.status(200).json({ status: true, message: '[❗] Usuário Registrado.' });
});

router.get('/user', async (req, res) => {
    let token = req.headers['authorization'];
    // remove Bearer from token
    token = token.split(' ')[1];
    if (!token) {
        return res.status(401).json({ status: false, message: '[❗] Nenhum token fornecido, clique no link que foi enviado para seu e-mail.' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'B3tterTh@nB');
        const user = database.getDatabaseByUser(decoded.mail);
        if (!user) {
            return res.status(404).json({ status: false, message: 'Usuário não encontrado' });
        }
        return res.status(200).json({ status: true, user: user, CurrentLimit: user.isPremium ? Number(process.env.premium_user_limit) : Number(process.env.free_user_limit) });
    } catch (error) {
        return res.status(401).json({ status: false, message: '[❗] Token inválido, clique no link que foi enviado para seu email.' });
    }
});

router.get('/fetchRecaptcha', async (req, res) => {
    if (!processR) {
        return res.status(404).json({ status: false, message: '[❗] Recaptcha não habilitado.' });
    }
    const recaptchaSiteKey = process.env.recaptcha_site_key;
    return res.status(200).json({ status: true, sitekey: recaptchaSiteKey });
})

router.get('/verify', async (req, res) => {
    const token = req.query.token;
    if (!token) {
        return res.status(400).json({ status: false, message: 'Token ausente' });
    }
    const user = database.getDatabaseByVerifyCode(token);
    if (!user) {
        return res.status(404).json({ status: false, message: 'Usuário não encontrado' });
    }
    if (user.isVerified) {
        return res.status(400).json({ status: false, message: 'Usuário já verificado' });
    }
    const updatedUser = database.UpdateDatabase(user.mail, { isVerified: true });
    return res.redirect("/login.html?verified=true");
})

router.post('/requestReset', async (req, res) => {
    const mail = req.body.mail;
    const recaptchaVerify = req.body.recaptchaVerify;
    if (!mail) {
        return res.status(400).json({ status: false, message: 'Falta mail' });
    }
    const user = database.getDatabaseByUser(mail);
    if (!user) {
        return res.status(404).json({ status: false, message: '[❗] Usuário não encontrado, verifique se é o e-mail correto.' });
    }

    if (processR && !recaptchaVerify) {
        return res.status(400).json({ status: false, message: 'Falta recaptcha' });
    }

    if (processR) {
        const recaptcha = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${process.env.recaptcha_secret}&response=${recaptchaVerify}`, {
            method: 'POST'
        });
        const recaptchaJson = await recaptcha.json();
        if (!recaptchaJson.success) {
            return res.status(400).json({ status: false, message: 'Recaptcha inválido' });
        }
    }

    const resetCode = crypto.randomBytes(20).toString('hex');
    const updatedUser = database.UpdateDatabase(user.mail, { resetCode: resetCode });
    try {
        const info = await mTransporter.sendMail({
            from: process.env.smtp_user,
            to: mail,
            subject: "Restaurar senha",
            html: `
            <html>
            <head>
            <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f4f4f4;
                color: #333;
                padding: 20px;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #fff;
                border-radius: 5px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            h1 {
                color: #007bff;
                text-align: center;
            }
            p {
                margin-bottom: 20px;
            }
            a {
                color: #007bff;
                text-decoration: none;
                font-weight: bold;
            }
            .signature {
                margin-top: 20px;
                border-top: 1px solid #ccc;
                padding-top: 10px;
                text-align: center;
            }
            </style>
            </head>
            <body>
            <div class="container">
            <h1>Restaurar senha</h1>
            <p>Olá usuário,</p>
            <p>Para redefinir sua senha, clique no link abaixo:</p>
            <p><a href="https://${req.headers.host}/api/manageusers/reset?token=${resetCode}">Restaurar senha</a></p>
            <p>Se você não solicitou a redefinição de sua senha, simplesmente ignore este e-mail.</p>
            <p>¡Obrigado!</p>
            <div class="signature">
            <p><strong>CarlosDlw</strong></p>
            </div>
            </div>
            </body>
            </html>
            `
        });
        //console.log("Message sent: %s", info.messageId);
        return res.status(200).json({ status: true, message: '[❗] E-mail enviado, verifique sua caixa de entrada ou pasta de spam.' });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: '[⚠️] Erro ao enviar e-mail, reporte o erro.' });
    }
})

router.get('/reset', async (req, res) => {
    const token = req.query.token;
    return res.redirect("/reset.html?resetToken=" + token);
})

router.post('/reset', async (req, res) => {
    const token = req.body.tokenReset;
    const password = req.body.password;
    if (!token || !password) {
        return res.status(400).json({ status: false, message: 'Dados ausentes' });
    }
    const users = database.getDatabase()
    const user = users.find(user => user.resetCode === token);
    if (!user) {
        return res.status(404).json({ status: false, message: '[❗] Usuário não encontrado, registre-se.' });
    }
    const unbase64 = Buffer.from(password, 'base64').toString('utf-8');
    const updatedUser = database.UpdateDatabase(user.mail, { hashPassword: crypto.createHash('md5').update(unbase64).digest('hex'), resetCode: undefined });
    return res.status(200).json({ status: true, message: '[❗] Redefinição de senha.' });
})


module.exports = router;
