const express = require("express");
const multer = require("multer");
const fs = require("fs");
const https = require("https");

const key = fs.readFileSync("localhostdns.key");
const cert = fs.readFileSync("localhostdns.crt");

const Answer = require("./answer");

const mysql = require("mysql2/promise");
const cors = require("cors");
//const upload = multer({dest: "public/resources/upload"});
//const multer = require("multer");
const validateEmail = require("email-validator");
const moment = require("moment");

const redis = require("redis");
const session = require("express-session");

const redisStorage = require('connect-redis')(session);
const redisClient = redis.createClient();

const app = express();
const jsonParser = express.json();

let pull = mysql.createPool({
    connectionLimit: 5,
    host: "localhost",
    user: "root",
    password: "qqqq",
    database: "rgd"
});

const configStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public/resources/upload");
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
})

app.use(
    session({
        store: new redisStorage({
            host: 'localhost',
            port: 6379,
            client: redisClient,
        }),
        name: "session",
        secret: '0',
        saveUninitialized: false,
        resave: false,
        rolling: true,
        cookie: {
            maxAge: (1000 * 60 * 60 * 60),
            httpOnly: true,
            sameSite: 'None',
            secure: true,
            path: '/',
        }
    })
)


//Установление политики CORS

let whiteList = ['http://localhost:4200', 'https://localhost:4200'];

let corsOptions = {
    // origin: function (origin, callback) {
    //     //console.log(origin);
    //     if (whiteList.indexOf(origin) !== -1 || !origin) {
    //         //console.log("da");
    //         callback(null, true);
    //     } else {
    //         console.log(origin);
    //         //console.log("net");
    //         //callback(null, false);
    //         callback(new Error("Not allowed by CORS"));
    //     }
    // },
    credentials: true,
}
app.use(cors(corsOptions))

//app.use(multer({dest: "public/resources"},).single("filedata"));

//Логгирование в консоль
app.use(function (request, response, next) {
    console.log(formDate(request));
    response.set('Content-Type', 'text/plain');

    //fs.appendFile("server.log", data + "\n", function(){});
    next();
});

//Проверка сессии
app.use(function (req, res, next) {

    if (!req.session.key) req.session.key = req.sessionID;

    //console.log(req.url);

    //Проверка логина

    if (!req.session.login && req.url !== '/login' && req.url !== '/1') {
        console.log(`Not auth! redirected to /login`);
        // return res.redirect(301, "login");
        let answer = new Answer();
        answer.statusCode = 301;
        answer.error = "No auth";
        return res.status(301).send(answer);
    }

    //console.log(req.session);
    // console.log(req.sessionID);
    return next();
})

app.use(express.static(__dirname + "/public"));

//******************************************************//
//**************** РАБОТА С РАСПИСАНИЕМ ****************//
//******************************************************//

app.post("/timetable/upload", function (req, res) {
    let filedata = req.file;

    console.log(filedata);
    return res.send(filedata);
})

//Получение таблицы рассписания
app.get("/timetable", function (req, res) {

    //console.log(req.query['station']);

    const station = (req.query['station'] && req.query['station'] !== 'all' ? Number(req.query['station']) : null),
        active = getActive(req.query['activity']);

    //console.log(station);
    //console.log(typeof station);

    if (station !== null && !isNumber(station)){
        return invalidName(res, `station ${station}`);
    }

    if (station){
        console.log('Одна станция');
    }
    else {
        console.log('Все станции');
    }

    //console.log(active);
    if (active !== undefined){
        if (active) {console.log('Активные станции');}
        else {console.log('НЕактивные станции');}
    }
    else {console.log('Любая активность');}

    pull.query("select train, time_format(time, '%H:%i') as time, date_format(date, '%d-%m-%Y') as date, frequency, frequencyDATA, name as stationName, IMEI from timetable join station on IMEI = timetable.stationIMEI where " + (station ? `IMEI = ${station} and` : '') + (active !== undefined ? ` active = ${active} and` : '' ) + " (" + ((req.session.role === Roles.admin) ? "true or " : "") + "station.IMEI in (select st.IMEI from station as st where st.ownerLogin = ? OR (st.IMEI in (select s2.stationIMEI from `user-station` as s2 where user = ?))))",
        [req.session.login, req.session.login])
        .then(result => {
            if (!result){
                throw 'empty db request';
            }
            //console.log(result[0]);
            for (let i = 0; i < result[0].length; i++) {
                // result[0][i].data = null;
                // switch (result[0][i].frequency) {
                //     case Frequency.evenDays: {
                //         result[0][i].frequency = Object.keys(Frequency)[Frequency.evenDays];
                //         break;
                //     }
                //     case Frequency.oddDays: {
                //         result[0][i].frequency = Object.keys(Frequency)[Frequency.oddDays];
                //         break;
                //     }
                //     case Frequency.oneDay: {
                //         result[0][i].frequency = Object.keys(Frequency)[Frequency.oneDay];
                //         result[0][i].data = result[0][i].date;
                //         break;
                //     }
                //     case Frequency.everyDay: {
                //         result[0][i].frequency = Object.keys(Frequency)[Frequency.everyDay];
                //         break;
                //     }
                //     case Frequency.weekdays: {
                //         result[0][i].frequency = Object.keys(Frequency)[Frequency.weekdays];
                //         break;
                //     }
                //     case Frequency.weekends: {
                //         result[0][i].frequency = Object.keys(Frequency)[Frequency.weekends];
                //         break;
                //     }
                //     case Frequency.weekly: {
                //         result[0][i].frequency = Object.keys(Frequency)[Frequency.weekly];
                //         let days = [];
                //         const data = result[0][i].frequencyDATA;
                //         for (let i = 0; i < data.length; i++) {
                //             //console.log(data[i]);
                //             if (data[i] === data[i].toUpperCase()) {
                //                 //console.log(data[i]);
                //                 //console.log(Object.keys(Days)[i + 1]);
                //                 days.push(Object.keys(Days)[i + 1]);
                //             }
                //         }
                //         //console.log(days);
                //         result[0][i].data = days;
                //         break;
                //     }
                //     default: {
                //         result[0][i].frequency = Object.keys(Frequency)[Frequency.none];
                //         break;
                //     }
                // }
                // delete result[0][i].frequencyDATA;
                // delete result[0][i].date;
                // //console.log(result[0][i]);
                transform(result[0][i]);
            }
            //console.log(Object.keys(Frequency)[Frequency.evenDays]);
            return processing(result[0], res, req);
        })
        .catch(err => {
            // console.log(err);
            // let answer = new Answer();
            // answer.statusCode = 404;
            // answer.error = true;
            // res.statusCode = 404;
            // return res.send(answer);
            return unknownError(req, res, err);
        })
});

//Добавление новой станции
app.post("/timetable/add", jsonParser, async function (req, res) {

    //Проверка прав доступа к функции
    if (!(req.session.role === Roles.admin || req.session.role === Roles.superuser || req.session.role === Roles.user)) {
        return accessDenied(res);
    }

    //Проверка на наличие файла
    if (!req.body) return res.sendStatus(400);

    if (!req.body.frequency
        || !req.body.time
        || !req.body.train
        || !req.body.IMEI) {
        return notFoundData(res, req.body);
    }

    //console.log(req.body);

    const newTT = {
        IMEI: req.body.IMEI,
        time: req.body.time,
        train: req.body.train,
        frequency: req.body.frequency,
        days: (req.body.days && req.body.days.length > 0) ? req.body.days : null,
        date: req.body.date ?? null,
    }

    //console.log(newTT);

    //Проверка доступа
    if (!await accessToStation(req.session.login, req.body.IMEI, req.session.role)) {
        return accessDenied(res, 'no rights');
    }

    let error = null;

    //let insertData = {};

    //console.log(Object.keys(Frequency)[Frequency.weekly]);

    switch (newTT.frequency) {
        case Object.keys(Frequency)[Frequency.weekly]: {    //Еженедельно

            //console.log('Еженедельно');

            if (!newTT.days || !newTT.days.length || newTT.days.length > 8){
                error = new Answer();
                error.statusCode = 401;
                error.error = 'incorrect days';
                break;
            }

            const days = newTT.days;

            // for (let i = 0; i < days.length; i++){
            //
            //     if (Days.isIn(days[i])){
            //         //console.log(`${days[i]} является днём`);
            //
            //     }
            // }

            let daysStr = '';
            for (let i = 0; i < 7; i++){
                let foundDay = false;
                for (let j = 0; j < days.length; j++){
                    if (days[j] === Object.keys(Days)[i + 1]){
                        foundDay = true;
                        break;
                    }
                }
                if (foundDay){
                    //daysStr.push(String.fromCharCode(('A'.charCodeAt(0) + i)));
                    daysStr += String.fromCharCode(('A'.charCodeAt(0) + i));
                }
                else {
                    //daysStr.push(String.fromCharCode(('a'.charCodeAt(0) + i)));
                    daysStr += String.fromCharCode(('a'.charCodeAt(0) + i))
                }
            }
            //console.log(daysStr);
            newTT.days = daysStr;
            break;
        }
        case Object.keys(Frequency)[Frequency.oneDay]: {        //Один раз

            //console.log('Однажды');

            if (!newTT.date || !moment(newTT.date, "YYYY-MM-DD").isValid()){
                error = new Answer();
                error.statusCode = 402;
                error.error = 'incorrect date';
                break;
            }
            break;
        }
        case Object.keys(Frequency)[Frequency.weekends]: {      //Выходные

            //console.log('Выходные');

            break;
        }
        case Object.keys(Frequency)[Frequency.weekdays]: {      //Будни

            //console.log('Будни');

            break;
        }
        case Object.keys(Frequency)[Frequency.everyDay]: {      //Каждый день

            //console.log('Каждый день');

            break;
        }
        case Object.keys(Frequency)[Frequency.oddDays]: {       //Нечётные дни

            //console.log('Нечётные дни');

            break;
        }
        case Object.keys(Frequency)[Frequency.evenDays]: {      //Чётные дни

            //console.log('Чётные дни');

            break;
        }
        default: {
            error = new Answer();
            error.statusCode = 403;
            error.error = 'incorrect frequency';
            break;
        }
    }

    if (error) {
        if (error.statusCode && error.error){
            console.log('ОШИБКА: некорректные данные: ' + error.error);

            return  res.status(error.statusCode).send(error);
        }
        else {
            return unknownError(req, res, error);
        }
    }

    newTT.frequency = Frequency[newTT.frequency];

    console.log(newTT);

    pull.query('insert into timetable (train, time, date, stationIMEI, frequency, frequencyDATA) values (?, ?, ?, ?, ?, ?)',
        [newTT.train, newTT.time, newTT.date, newTT.IMEI, newTT.frequency, newTT.days])
        .then(insertResult => {
            if (!insertResult){
                throw 'empty db request';
            }
            //console.log(insertResult);
            if (insertResult[0] && insertResult[0]['affectedRows'] > 0){
                console.log(`Расписание успешно добавлено`);
                let answer = new Answer();
                answer.statusCode = 201;
                answer.isCreated = true;
                answer.wasExist = false;

                return res.status(201).send(answer);
            }
            else {
                console.log('ОШИБКА: расписание не загружено или загруженно некорректно');
                console.log(insertResult);
                let answer = new Answer();
                answer.statusCode = 400;
                answer.wasExist = false;
                answer.isCreated = false;

                return res.status(answer.statusCode).send(answer);
            }
        })
        .catch(error => {
            console.log('ОШИБКА!');
            console.log(error);
            if (error && error.errno && error.errno === 1062){
                let answer = new Answer();
                answer.statusCode = 404;
                answer.isCreated=false;
                answer.wasExist = true;

                console.log('Данная запись уже существует');

                return res.status(answer.statusCode).send(answer);
            }
            return unknownError(req, res, error);
        })

    //return res.send({message: 'ok'});

});

//Получение записи расписания по IEMI, train и time
app.get("/timetable/edit/:IMEI/:train/:time", async function (req, res) {

    let IMEI = null,
        train = null,
        time = null;

    if (!req.params['IMEI']
        || !req.params['train']
        || !req.params['time']){
        return notFoundData(res, req.params);
    }

    IMEI = req.params['IMEI'];
    train = req.params['train'];
    time = req.params['time'];

    //Проверка прав доступа к функции
    if (!(req.session.role === Roles.admin || req.session.role === Roles.superuser || req.session.role === Roles.user)
        || !await accessToStation(req.session.login, IMEI, req.session.role)) {
        return accessDenied(res);
    }

    //console.log(IMEI === 1234);
    //console.log(train === 322);
    //console.log(time === '13:32');

    pull.query("select train, time_format(time, '%H:%i') as time, date_format(date, '%d-%m-%Y') as date, frequency, frequencyDATA, name as stationName, IMEI from timetable join station on IMEI = timetable.stationIMEI where IMEI = ? and train = ? and time = ?",
        [IMEI, train, time])
        .then(search => {
            if (!search){
                throw 'empty db request';
            }

            if (search[0][0]){
                transform(search[0][0]);
            }

            //console.log(search[0]);


            return processing(search[0], res, req);
        })
        .catch(error => {
            return unknownError(req, res, error);
        })
})

//Обновление записи расписания
app.put("/timetable/edit/:IMEI/:train/:time/update", jsonParser, async function (req, res) {

    let IMEI = null,
        train = null,
        time = null;

    if (!req.params['IMEI']
        || !req.params['train']
        || !req.params['time']){
        return notFoundData(res, req.params);
    }

    IMEI = req.params['IMEI'];
    train = req.params['train'];
    time = req.params['time'];

    //Проверка на наличие файла
    if (!req.body) return res.sendStatus(400);

    //Проверка прав доступа к функции
    if (!(req.session.role === Roles.admin || req.session.role === Roles.superuser || req.session.role === Roles.user)
        || !await accessToStation(req.session.login, IMEI, req.session.role)) {
        return accessDenied(res);
    }

    let oldAvailData = {};
    let oldIncomingData = req.body.old ?? {};
    //console.log(oldIncomingData);

    await pull.query("select train, time_format(time, '%H:%i') as time, date_format(date, '%d-%m-%Y') as date, frequency, frequencyDATA, name as stationName, IMEI from timetable join station on IMEI = timetable.stationIMEI where IMEI = ? and train = ? and time = ?",
        [IMEI, train, time])
        .then(search => {
            if (!search){
                throw 'empty db request';
            }

            if (search[0][0]){
                transform(search[0][0]);
                //console.log(search[0]);

                oldAvailData = search[0][0];
                //return processing(oldAvailData, res, req);
            }

            //Проверка совпадения старых и новых данных
            if (!oldAvailData.deepEqual(oldIncomingData)){
                throw 'notFoundData';
            }

            let updateData = req.body.new;
            updateData.days = req.body.new.data;
            updateData.date = req.body.new.data;
            //console.log(updateData);

            if (!updateData
                || !updateData.IMEI
                || !updateData.train
                || !updateData.time
                || !updateData.frequency
                // || (updateData.frequency === Frequency.weekly && !updateData.days)
                // || (updateData.frequency === Frequency.oneDay && !updateData.date)
            )
            {
                throw 'notFoundData';
            }

            // if (updateData.train !== oldAvailData.train
            //     || updateData.IMEI !== oldAvailData.IMEI
            //     || updateData.time !== oldAvailData.time){
            //     return invalidName(res, 'Изменение IMEI, поезда или времени');
            // }

            let error = null;
            //console.log(updateData.frequency);

            switch (updateData.frequency) {
                case Object.keys(Frequency)[Frequency.weekly]: {    //Еженедельно

                    //console.log('Еженедельно');
                    console.log(updateData.days);

                    if (!updateData || !updateData.days || !updateData.days.length || updateData.days.length > 8){
                        error = new Answer();
                        error.statusCode = 401;
                        error.error = 'incorrect days';
                        break;
                    }

                    const days = updateData.data;

                    // for (let i = 0; i < days.length; i++){
                    //
                    //     if (Days.isIn(days[i])){
                    //         //console.log(`${days[i]} является днём`);
                    //
                    //     }
                    // }

                    let daysStr = '';
                    for (let i = 0; i < 7; i++){
                        let foundDay = false;
                        for (let j = 0; j < days.length; j++){
                            if (days[j] === Object.keys(Days)[i + 1]){
                                foundDay = true;
                                break;
                            }
                        }
                        if (foundDay){
                            //daysStr.push(String.fromCharCode(('A'.charCodeAt(0) + i)));
                            daysStr += String.fromCharCode(('A'.charCodeAt(0) + i));
                        }
                        else {
                            //daysStr.push(String.fromCharCode(('a'.charCodeAt(0) + i)));
                            daysStr += String.fromCharCode(('a'.charCodeAt(0) + i))
                        }
                    }
                    //console.log(daysStr);
                    updateData.days = daysStr;
                    updateData.date = null;
                    break;
                }
                case Object.keys(Frequency)[Frequency.oneDay]: {        //Один раз

                    //console.log('Однажды');

                    if (!updateData.date || !moment(updateData.date, "YYYY-MM-DD").isValid()){
                        error = new Answer();
                        error.statusCode = 402;
                        error.error = 'incorrect date';
                        break;
                    }
                    updateData.days = null;
                    break;
                }
                case Object.keys(Frequency)[Frequency.weekends]: {      //Выходные

                    //console.log('Выходные');

                    break;
                }
                case Object.keys(Frequency)[Frequency.weekdays]: {      //Будни

                    //console.log('Будни');

                    break;
                }
                case Object.keys(Frequency)[Frequency.everyDay]: {      //Каждый день

                    //console.log('Каждый день');

                    break;
                }
                case Object.keys(Frequency)[Frequency.oddDays]: {       //Нечётные дни

                    //console.log('Нечётные дни');

                    break;
                }
                case Object.keys(Frequency)[Frequency.evenDays]: {      //Чётные дни

                    //console.log('Чётные дни');

                    break;
                }
                default: {
                    error = new Answer();
                    error.statusCode = 403;
                    error.error = 'incorrect frequency';
                    break;
                }
            }

            if (error) {
                if (error.statusCode && error.error){
                    console.log('ОШИБКА: некорректные данные: ' + error.error);

                    throw error;
                    //return  res.status(error.statusCode).send(error);
                }
                else {
                    throw error;
                    //return unknownError(req, res, error);
                }
            }

            updateData.frequency = Frequency[updateData.frequency];

            return pull.query('update timetable set train = ?, time = ?, date = ?, stationIMEI = ?, frequency = ?, frequencyDATA = ? where train = ? and time = ? and stationIMEI = ?',
                [updateData.train, updateData.time, updateData.date, updateData.IMEI, updateData.frequency, updateData.days, oldAvailData.train, oldAvailData.time, oldAvailData.IMEI])
        })
        .then(insertResult => {
            if (!insertResult){
                throw 'empty db request';
            }
            //console.log(insertResult);
            if (insertResult[0] && insertResult[0]['affectedRows'] > 0){
                console.log(`Расписание успешно изменено`);
                let answer = new Answer();
                answer.statusCode = 201;
                answer.isCreated = true;
                answer.wasExist = false;

                return res.status(201).send(answer);
            }
            else {
                console.log('ОШИБКА: расписание не загружено или загруженно некорректно');
                console.log(insertResult);
                let answer = new Answer();
                answer.statusCode = 400;
                answer.wasExist = false;
                answer.isCreated = false;

                return res.status(answer.statusCode).send(answer);
            }
        })
        .catch(error => {

            if (error && error.errno && error.errno === 1062){
                console.log('ОШИБКА!');
                console.log(error);
                let answer = new Answer();
                answer.statusCode = 404;
                answer.isCreated=false;
                answer.wasExist = true;

                console.log('Данная запись уже существует');

                return res.status(answer.statusCode).send(answer);
            }
            return unknownError(req, res, error);
        })

    //res.send(ans);
})

//Удаление записи
app.delete("/timetable/edit/:IMEI/:train/:time/delete", jsonParser, async function (req, res) {

    let IMEI = null,
        train = null,
        time = null;

    if (!req.params['IMEI']
        || !req.params['train']
        || !req.params['time']){
        return notFoundData(res, req.params);
    }

    IMEI = req.params['IMEI'];
    train = req.params['train'];
    time = req.params['time'];

    //Проверка прав доступа к функции
    if (!(req.session.role === Roles.admin || req.session.role === Roles.superuser || req.session.role === Roles.user)
        || !await accessToStation(req.session.login, IMEI, req.session.role)) {
        return accessDenied(res);
    }

    pull.query("delete from timetable where stationIMEI = ? and train = ? and time = ?",
            [IMEI, train, time])
        .then(result => {
            if (!result){
                throw 'empty db request';
            }
            //console.log(result[0]['affectedRows'] > 0);
            if (result[0]['affectedRows'] > 0) {
                console.log(`Запись успешно удалена пользователем ${req.session.login}`);

                let answer = new Answer();
                answer.isCreated = false;
                answer.wasExist = true;
                answer.statusCode = 200;

                return res.status(200).send(answer);
            } else {
                console.log(`ОШИБКА: запись НЕ УДАЛЕНА пользователем ${req.session.login}`);

                let answer = new Answer();
                answer.isCreated = true;
                answer.wasExist = true;
                answer.statusCode = 404;

                return res.status(404).send(answer);
            }
        })
        .catch(error => {
            return unknownError(req, res, error);
        })

})


//Типы периодичности
const Frequency = Object.freeze({

    none: 0,        //Не назначено || ошибка

    everyDay: 1,    //ежедневно
    oddDays: 2,     //нечётные дни
    evenDays: 3,    //чётные дни
    weekends: 4,    //по выходным
    weekdays: 5,    //по будням

    //Требуют вспомогательную строку frequencyDATA
    weekly: 6,      //еженедельно
    oneDay: 7,      //один раз
})

//Перечисление дней недели
const Days = Object.freeze({
    none: 0,    //Ошибка
    Mon: 1,     //Понедельник
    Tue: 2,     //Вторник
    Wed: 3,     //Среда
    Thu: 4,     //Четверг
    Fri: 5,     //Пятница
    Sat: 6,     //Суббота
    Sun: 7      //Воскресенье
})

//Трансформация
function transform(row){
    if (!row) return;
    row.data = null;
    switch (row.frequency) {
        case Frequency.evenDays: {
            row.frequency = Object.keys(Frequency)[Frequency.evenDays];
            break;
        }
        case Frequency.oddDays: {
            row.frequency = Object.keys(Frequency)[Frequency.oddDays];
            break;
        }
        case Frequency.oneDay: {
            row.frequency = Object.keys(Frequency)[Frequency.oneDay];
            row.data = row.date;
            break;
        }
        case Frequency.everyDay: {
            row.frequency = Object.keys(Frequency)[Frequency.everyDay];
            break;
        }
        case Frequency.weekdays: {
            row.frequency = Object.keys(Frequency)[Frequency.weekdays];
            break;
        }
        case Frequency.weekends: {
            row.frequency = Object.keys(Frequency)[Frequency.weekends];
            break;
        }
        case Frequency.weekly: {
            row.frequency = Object.keys(Frequency)[Frequency.weekly];
            let days = [];
            const data = row.frequencyDATA;
            for (let i = 0; i < data.length; i++) {
                //console.log(data[i]);
                if (data[i] === data[i].toUpperCase()) {
                    //console.log(data[i]);
                    //console.log(Object.keys(Days)[i + 1]);
                    days.push(Object.keys(Days)[i + 1]);
                }
            }
            //console.log(days);
            row.data = days;
            break;
        }
        default: {
            row.frequency = Object.keys(Frequency)[Frequency.none];
            break;
        }
    }
    delete row.frequencyDATA;
    delete row.date;
    //console.log(result[0][i]);
    //return row;
}

//Обработка активности для запроса расписания
function getActive(string){
    //return (string && string !== 'all' ? Boolean(string) : undefined)
    // if (!string) {
    //     return undefined;
    // }
    if (string === 'true' || string === '1'){
        return true;
    }
    if (string === 'false' || string === '0'){
        return false;
    }
    return undefined;
}

// //Неудачная трансформация
// function transformTT(data){
//     for (let i = 0; i < data.length; i++) {
//         data[i].data = null;
//         switch (data[i].frequency) {
//             case Frequency.evenDays: {
//                 data[i].frequency = Object.keys(Frequency)[Frequency.evenDays];
//                 break;
//             }
//             case Frequency.oddDays: {
//                 data[i].frequency = Object.keys(Frequency)[Frequency.oddDays];
//                 break;
//             }
//             case Frequency.oneDay: {
//                 data[i].frequency = Object.keys(Frequency)[Frequency.oneDay];
//                 data[i].data = data[i].date;
//                 break;
//             }
//             case Frequency.everyDay: {
//                 data[i].frequency = Object.keys(Frequency)[Frequency.everyDay];
//                 break;
//             }
//             case Frequency.weekdays: {
//                 data[i].frequency = Object.keys(Frequency)[Frequency.weekdays];
//                 break;
//             }
//             case Frequency.weekends: {
//                 data[i].frequency = Object.keys(Frequency)[Frequency.weekends];
//                 break;
//             }
//             case Frequency.weekly: {
//                 data[i].frequency = Object.keys(Frequency)[Frequency.weekly];
//                 let days = [];
//                 const data = data[i]['frequencyDATA'];
//                 for (let i = 0; i < data.length; i++) {
//                     //console.log(data[i]);
//                     if (data[i] === data[i].toUpperCase()) {
//                         //console.log(data[i]);
//                         //console.log(Object.keys(Days)[i + 1]);
//                         days.push(Object.keys(Days)[i + 1]);
//                     }
//                 }
//                 //console.log(days);
//                 data[i].data = days;
//                 break;
//             }
//             default: {
//                 data[i].frequency = Object.keys(Frequency)[Frequency.none];
//                 break;
//             }
//         }
//         delete data[i]['frequencyDATA'];
//         delete data[i].date;
//         //console.log(result[0][i]);
//     }
// }

//************************************************************//
//**************** КОНЕЦ РАБОТЫ С РАСПИСАНИЕМ ****************//
//************************************************************//


//-----------------------------------------------------------//


//****************************************************//
//**************** РАБОТА СО СТАНЦИЯМИ ***************//
//****************************************************//

//Получение списка станций
app.get("/stations", function (req, res) {

    const user = req.session.login;
    //console.log(user);

    let sql = "select st.name as stationName, st.IMEI, st.description, st.ownerLogin, st.active as activity from station as st where ownerLogin = ? OR (st.IMEI in (select stationIMEI from `user-station` where user = ?)) " + (req.session.role === Roles.admin ? 'OR true ' : '') + "order by name";


    pull.query(sql, [user, user])               //Получает список станицй без пользователей
        .then(async resultStation => {
            if (!resultStation){
                throw 'empty db request';
            }
            //return processing(resultStation[0], res, req);
            let stations = resultStation[0];
            //console.log(stations);

            //Добавляет каждой станции список пользователей
            for (let indexStation = 0; indexStation < stations.length; indexStation++) {
                let station = stations[indexStation];
                station.activity = (station.activity !== 0); //Переобразование в bool
                //await getUsersForStation(req, res, station);
                if (req.session.role === Roles.admin || req.session.role === Roles.superuser){
                    let err = await getUsersForStation(req, res, station);
                    //console.log(err);
                    if (err){
                        return unknownError(req, res, err);
                    }
                }
                else {
                    station['users'] = [];
                }
                //console.log(station);
                // await pull.query('select `user`.name, `user`.surname, `user`.login from `user-station` join user on  `user`.login = `user-station`.user where `user-station`.stationIMEI = ?', station.IMEI)
                //     .then(userResult => {
                //         //console.log(userResult[0]);
                //         let users = [];
                //
                //         for (let indexRow = 0; indexRow < userResult[0].length; indexRow++){
                //             let user = {
                //                 Login: null,
                //                 Name: null,
                //                 Surname: null,
                //             }
                //             user.Login = userResult[0][indexRow].login;
                //             user.Name = userResult[0][indexRow].name;
                //             user.Surname = userResult[0][indexRow].surname;
                //             //console.log(user);
                //             users.push(user);
                //         }
                //
                //         station.users = users;
                //
                //         //console.log(users);
                //     })
                //     .catch(error => {
                //         return unknownError(req, res, error);
                //     })
                //console.log(station);
            }
            return processing(stations, res, req); //Отправка
        })
        .catch(err => {
            return unknownError(req, res, err);
        })
});

// Добавление станции
app.post("/stations/add", jsonParser, function (req, res) {

    //Проверка прав доступа к функции
    if (!(req.session.role === Roles.admin || req.session.role === Roles.superuser)) {
        return accessDenied(res);
    }

    //Проверка на наличие файла
    if (!req.body) return res.sendStatus(400);

    //console.log(req.body);

    // Проверка содержимого файла
    if (!req.body.stationName
        || !req.body.IMEI ||
        !(req.body.activity === false || req.body.activity === true)) {
        //return res.sendStatus(204);
        return notFoundData(res, req.body);
    }

    //Проверка на допустимость IMEI
    //if (req.body.IMEI !== IMEInumber.toString()) {
    if (isNumber(req.body.IMEI)){
        // console.log(req.body.IMEI);
        // console.log(Number(req.body.IMEI).toString());
        //console.log('yes');
        return invalidName(res, req.body.IMEI);
    }

    //Добавление данных в базу

    const station = {
        stationName: req.body.stationName,
        IMEI: req.body.IMEI,
        description: req.body.description,
        ownerLogin: req.session.login,
        active: req.body.activity
    };


    const data = [
        station.stationName,
        station.IMEI,
        station.description,
        station.ownerLogin,
        station.active];

    const sql = `insert into station (name, IMEI, description, ownerLogin, active) values (?, ?, ?, ?, ?)`;

    console.log(station);
    pull.query(sql, data)
        .then(result => {
            if (!result){
                throw 'empty db request';
            }
            //console.log(result);
            res.statusCode = 201;
            let answer = new Answer();
            answer.statusCode = 201;
            answer.isCreated = true;
            answer.name = station.stationName;
            answer.IMEI = station.IMEI;
            answer.wasExist = false;
            return res.send(answer);
        })
        .catch(err => {
            console.log(err);

            let answer = new Answer();
            answer.statusCode = 404;
            answer.error = err.sqlMessage;
            answer.isCreated = false;
            answer.name = station.stationName;
            answer.IMEI = station.IMEI;

            answer.wasExist = err.errno === 1062;
            return res.send(answer);
        });
});

// Обновление данных о станции
app.put("/stations/:IMEI/update", jsonParser, async function (req, res) {

    const stationIMEI = req.params['IMEI'];

    //Проверка на наличие файла
    if (!req.body) return res.sendStatus(400);

    //console.log(req.body);

    // Проверка содержимого файла
    if (!req.body.old || !req.body.new
        || !req.body.old.stationName || !req.body.old.IMEI
        || !req.body.new.stationName || !req.body.new.IMEI
        || !(req.body.new.activity === false || req.body.new.activity === true)
        || !req.body.old.users || !req.body.new.users
        || (!req.body.old.users.length && req.body.old.users.length !== 0)
        || (!req.body.new.users.length && req.body.new.users.length !== 0)
    ) {
        return notFoundData(res, req.body);
    }

    console.log(req.body);

    //console.log(await accessToStation(req.session.login, req.body.old.IMEI));
    //Проверка доступа
    if (!await accessToStation(req.session.login, req.body.old.IMEI, req.session.role)) {
        return accessDenied(res, 'no rights');
    }


    // // Проверка на допустимость имени
    // if (req.body.new.stationName.indexOf('?') !== -1) {
    //     return invalidName(res, req.body.stationName);
    // }

    //Проверка на допустимость IMEI
    if (
        !(req.body.new.IMEI === req.body.old.IMEI
            && req.body.old.IMEI === stationIMEI
            && req.body.new.IMEI === stationIMEI)
    ) {
        return invalidName(res, req.body.new.IMEI);
    }

    let oldStation = {};

    let corrected = true;
    let unkErr = false;
    await pull.query('select name as stationName, IMEI, description, active as activity from station where IMEI = ?', stationIMEI)
        .then(async searchResult => {
            if (!searchResult){
                throw 'empty db request';
            }
            //console.log(searchResult[0]);
            if (searchResult[0].length !== 0) {
                searchResult[0][0].activity = (searchResult[0][0].activity === 1);
                await getUsersForStation(req, res, searchResult[0][0]);
                oldStation = searchResult[0][0];
            } else {
                corrected = false;
            }
        })
        .catch(error => {
            unkErr = error;
            //return unknownError(req, res, error);
        })

    if (unkErr){
        return unknownError(req, res, unkErr);
    }

    if (!corrected) {
        return invalidName(res, stationIMEI);
    }

    const updateStation = {
        name: req.body.new.stationName,
        IMEI: req.body.new.IMEI,
        activity: req.body.new.activity,
        usersOLD: req.body.old.users,
        usersNEW: req.body.new.users,
        description: req.body.new.description,
    }

    //console.log('OLD');
    //console.log(req.body.old.users);
    //console.log('NEW');
    //console.log(req.body.new.users);

    //console.log(updateStation);
    //console.log(oldStation);
    //console.log(req.body.old);

    if (oldStation.IMEI !== req.body.old.IMEI
        || oldStation.stationName !== req.body.old.stationName
        || oldStation.activity !== req.body.old.activity) {
        console.log('Полученные данные и данные с сервера не совпадают!');
        return res.status(400).send({status: 400});
    }

    // Поиск станции в базе
    //const oldData = [req.body.old.stationName, req.body.old.IMEI, req.body.old.description];

    //Формирование списка изменённых пользователей
    let usersDelete = [];
    let creator = null;
    let usersAdd = [];

    if (req.session.role === Roles.admin || req.session.role === Roles.superuser){
        //Определение, каких пользователей необходимо удалить
        for (let iOLD = 0; iOLD < updateStation.usersOLD.length; iOLD++) {
            let founded = false;
            for (let iNEW = 0; iNEW < updateStation.usersNEW.length; iNEW++) {
                //console.log(updateStation.usersOLD[iOLD].Login + ' - ' + updateStation.usersNEW[iNEW].Login);
                if (updateStation.usersOLD[iOLD].Login === updateStation.usersNEW[iNEW].Login) {
                    founded = true;
                    break;
                }
            }
            if (!founded) {
                await pull.query("select max(if(IMEI = ? and ownerLogin = ?, 1, 0)) as owner from station", [
                    stationIMEI,
                    updateStation.usersOLD[iOLD].Login
                ])
                    .then(result => {
                        if (!result){
                            throw 'empty db request';
                        }
                        //console.log(result[0][0]);
                        if (result[0][0]['owner'] === 1) {
                            creator = updateStation.usersOLD[iOLD].Login;
                        } else {
                            usersDelete.push(updateStation.usersOLD[iOLD].Login);
                        }
                    })
                    .catch(error => {
                        unkErr = error;
                        //return unknownError(req, res, error);
                    })
            }
            if (unkErr){
                return unknownError(req, res, unkErr);
            }
        }

        console.log('Пользователи на удаление');
        console.log(usersDelete);

        if (creator) {
            console.log(`Владелец станции ${creator} тоже удаляется`);
        }

        //Определение, каких пользователей надо добавить
        for (let iNEW = 0; iNEW < updateStation.usersNEW.length; iNEW++) {
            let founded = false;
            for (let iOLD = 0; iOLD < updateStation.usersOLD.length; iOLD++) {
                if (updateStation.usersNEW[iNEW].Login === updateStation.usersOLD[iOLD].Login
                    && updateStation.usersNEW[iNEW].Login !== req.session.login) {
                    founded = true;
                    break;
                }
            }
            if (!founded) {
                usersAdd.push(updateStation.usersNEW[iNEW].Login);
            }
        }

        console.log('Пользователи на добавление в станцию')
        console.log(usersAdd);
    }

    let allCool = true;

    const newData = [updateStation.name, updateStation.description, updateStation.activity, stationIMEI];
    pull.query("update station set name = ?, description = ?, active = ? where IMEI = ?", newData)
        .then(resultInsert => {
            if (!resultInsert){
                throw 'empty db request';
            }
            //console.log(resultInsert[0]);
            if (resultInsert[0]['affectedRows'] !== 1) {
                // let answer = new Answer();
                // answer.statusCode = 200;
                // answer.isCreated = true;
                // answer.wasExist = true;
                // return res.send(answer);
                allCool = false;
                throw resultInsert[0];
            }

            if (usersDelete.length !== 0 || creator || usersAdd.length !== 0) {
                console.log('Обновление списка пользователей...')
            } else {
                console.log('Обновление списка пользователей не требуется');
            }

            //Удаление пользователей
            let promiseArray = [];
            if (usersDelete.length !== 0) {
                console.log('Удаление пользователей');
            }
            for (let i = 0; i < usersDelete.length; i++) {
                promiseArray.push(
                    pull.query('delete from `user-station` where stationIMEI = ? and user = ?',
                        [stationIMEI, usersDelete[i]])
                )
            }
            return Promise.allSettled(promiseArray);
        })
        .then(async deleteResult => {
            if (!deleteResult){
                throw 'empty db request';
            }
            //console.log(deleteResult);
            for (let i = 0; i < deleteResult.length; i++) {
                if (deleteResult[i]['status'] === 'fulfilled' && deleteResult[i]['value'][0]['affectedRows'] > 0) {
                    console.log(`Пользователь ${usersDelete[i]} успешно удалён из станции ${stationIMEI}`);
                } else {
                    allCool = false;
                    console.log(`ОШИБКА: Пользователь ${usersDelete[i]} НЕ УДАЛЁН из станции ${stationIMEI}`);
                }
            }

            //Перемещение управления от creator к авторизованному пользователю
            if (creator) {
                console.log(`Перемещание управлением станции ${stationIMEI} от ${creator} администратору ${req.session.login}`);

                await pull.query('update station set ownerLogin = ? where IMEI = ?',
                    [req.session.login, stationIMEI])
                    .then(deleteResult => {
                        if (deleteResult[0]['affectedRows'] && deleteResult[0]['affectedRows'] === 1) {
                            console.log(`Управление станцией ${stationIMEI} успешно передано ${req.session.login}`);
                        } else {
                            allCool = false;
                            console.log(`ОШИБКА: не удалось переместить управление станцией ${stationIMEI} от пользователя ${creator} пользователю ${req.session.login}`)
                        }
                    })
            }

            //Доабвление новых пользователей
            if (usersAdd.length !== 0) {
                console.log('Добавление новых пользователей')
            }
            let promiseArray = [];
            for (let i = 0; i < usersAdd.length; i++) {
                promiseArray.push(
                    pull.query("insert into `user-station` (stationIMEI, user) values (?, ?)",
                        [stationIMEI, usersAdd[i]])
                )
            }
            return Promise.allSettled(promiseArray);
        })
        .then(result => {
            if (!result){
                throw 'empty db request';
            }
            for (let i = 0; i < result.length; i++) {
                if (result[i]['status'] === 'fulfilled' && result[i]['value'][0]['affectedRows'] > 0) {
                    console.log(`Пользователь ${usersAdd[i]} успешно добавлен на станцию ${stationIMEI}`);
                } else {
                    allCool = false;
                    console.log(`ОШИБКА: пользователь ${usersAdd[i]} НЕ ДОБАВЛЕН на станцию ${stationIMEI}`);
                }
            }

            if (allCool) {
                let answer = new Answer();
                answer.statusCode = 201;
                answer.isCreated = true;
                answer.wasExist = true;
                return res.status(201).send(answer);
            } else {
                let answer = new Answer();
                answer.isCreated = true;
                answer.wasExist = true;
                answer.statusCode = 204;
                answer.error = 'not all users have been added/deleted';

                return res.status(204).send(answer);
            }
        })
        .catch(error => {
            if (error['affectedRows'] && error['affectedRows'] !== 1) {
                let answer = new Answer();
                answer.statusCode = 400;
                answer.error = 'error updating data';

                return res.status(400).send(answer);
            }
            return unknownError(req, res, error);
        })

    // pull.query("select id from station where IMEI = ?", req.body.old.IMEI)
    //     .then(resultSearch => {
    //         //console.log(resultSearch[0]);
    //         // Если запись существует, то вернётся не пустой объект
    //         if (resultSearch[0][0]) {
    //             const idRow = resultSearch[0][0]['id'];
    //
    //         } else {
    //             console.log(`Ошибка: станции ${req.body.old.stationName} не существует`);
    //             let answer = new Answer();
    //             answer.statusCode = 404;
    //             answer.wasExist = false;
    //             answer.isCreated = false;
    //             return res.send(answer);
    //         }
    //     })
    //     .catch(error => {
    //         return unknownError(req, res, error);
    //     })
})

// Удаление станции
app.delete("/stations/delete", async function (req, res) {

    //Проверка корректности данных
    if (!req.query.IMEI) {
        return notFoundData(res, req.query.IMEI);
    }

    //Проверка прав доступа к функции
    if (!(req.session.role === Roles.admin || req.session.role === Roles.superuser)
        || !await accessToStation(req.session.login, req.query.IMEI, req.session.role)) {
        return accessDenied(res);
    }

    // Поиск станции в базе
    pull.query("select count(*) from station where IMEI = ?", req.query.IMEI)
        .then(resultSearch => {
            if (!resultSearch){
                throw 'empty db request';
            }
            //console.log(resultSearch[0]);
            // Если запись существует, то вернётся не пустой объект
            if (resultSearch[0][0]['count(*)'] || resultSearch[0][0]['count(*)'] === 1) {
                //const rowData = [req.query.IMEI];
                //console.log(resultSearch[0]);
                //console.log(rowData);

                pull.query("delete from station where IMEI = ?", req.query.IMEI)
                    .then(deleteResult => {
                        if (!deleteResult){
                            throw 'empty db request';
                        }
                        //console.log(deleteResult[0]);
                        console.log(`Успех: станция ${req.query.IMEI} удалена`);
                        let answer = new Answer();
                        answer.statusCode = 200;
                        answer.wasExist = true;
                        answer.isCreated = false;
                        answer.IMEI = req.query.IMEI;
                        return res.send(answer);
                    })
                    .catch(error => {
                        return unknownError(req, res, error);
                    })
            } else {
                console.log(`Ошибка: станции ${req.query.IMEI} не существует`);
                let answer = new Answer();
                answer.wasExist = false;
                answer.isCreated = false;
                answer.statusCode = 404;
                return res.status(404).send(answer);
            }
        })
        .catch(error => {
            return unknownError(req, res, error);
        })
})

// Получение станции по имени
app.get("/stations/:stationIMEI", async function (req, res) {
    const stationIMEI = req.params['stationIMEI'];

    //console.log(stationName);
    //Проверка доступа
    if (!await accessToStation(req.session.login, stationIMEI, req.session.role)) {
        return accessDenied(res, 'no rights');
    }

    pull.query("select name as stationName, IMEI, `description`, active as activity, ownerLogin from station where IMEI = ?", stationIMEI)
        .then(async result => {
            if (!result){
                throw 'empty db request';
            }
            // console.log(result[0][0]);
            if (!result[0][0]) {
                console.log(`Ошибка: Станции ${stationIMEI} не существует`);
                let answer = new Answer();
                answer.statusCode = 404;
                answer.isCreated = false;
                return res.status(404).send(answer);
            }
            result[0][0].activity = (result[0][0].activity !== 0);
            if (req.session.role === Roles.admin || req.session.role === Roles.superuser){
                await getUsersForStation(req, res, result[0][0]);
            }
            else {
                result[0][0]['users'] = [];
            }
            //console.log(result[0][0]);
            return processing(result[0], res, req);
        })
        .catch(error => {
            return unknownError(req, res, error);
        })
})

async function getUsersForStation(req, res, station) {
    // console.log(station);
    // console.log()
    // console.log(req.session.login === station.ownerLogin);
    await pull.query("select us.name, us.surname, us.login from user as us where (\n" +
        "\t(us.login in (select user from `user-station` where stationIMEI = ?)) \n" +
        "    or (us.login in (select ownerLogin from station where ownerLogin = us.login and IMEI = ?)\n" +
        "\t\t" + (req.session.login === station.ownerLogin ? " and us.login != ?" : "") + ")) and us.role != 3",
        [station.IMEI, station.IMEI, station.ownerLogin])
        .then(userResult => {
            if (!userResult){
                throw 'empty db request';
            }
            //console.log(userResult[0]);
            let users = [];

            for (let indexRow = 0; indexRow < userResult[0].length; indexRow++) {
                let user = {
                    Login: null,
                    Name: null,
                    Surname: null,
                }
                user.Login = userResult[0][indexRow].login;
                user.Name = userResult[0][indexRow].name;
                user.Surname = userResult[0][indexRow].surname;
                //console.log(user);
                users.push(user);
            }

            station.users = users;

            return null;
            //console.log(users);
        })
        .catch(error => {
            //console.log(error);
            report(req, error);
            return error;
        })
}

//**********************************************************//
//*************** КОНЕЦ РАБОТЫ СО СТАНЦИЯМИ ****************//
//**********************************************************//


//-----------------------------------------------------------//


//****************************************************//
//************** РАБОТА С ПОЛЬЗОВАТЕЛЕМ **************//
//****************************************************//

//Вход пользователя
app.post("/login", jsonParser, function (req, res) {

    //console.log("Loggin works!");

    //Проверка существования заначений
    if (!req.body.Login || !req.body.Password) {
        return notFoundData(res, req.body);
    }

    let userData = [req.body.Login, toCrypt(req.body.Password)];

    //Проверка существования пользователей
    pull.query('select count(*), role from user where login = ? and password = ?', userData)
        .then(searchResult => {
            if (!searchResult){
                throw 'empty db request';
            }
            //console.log(searchResult[0]);
            let result = searchResult[0][0];

            //console.log(result);

            if (result['count(*)'] === 1 && result['role']) {
                //console.log(`Нашёл ${userData[0]}`);
                console.log(`Успешный вход: ${userData[0]}`);
                req.session.login = userData[0];
                req.session.role = result['role'];

                let answer = new Answer();
                answer.statusCode = 200;
                answer.content = result['role'];

                return res.status(200).send(answer);
            }
            //console.log(`Не нашёл`);
            console.log(`Вход не выполенен: ${userData[0]}`);

            let answer = new Answer();
            answer.statusCode = 404;
            answer.error = 'not found';

            return res.status(404).send(answer);
        })
        .catch(error => {
            return unknownError(req, res, error);
        })

    //return res.sendStatus(200);
})

//!!!!!!АХТУНГ
app.get("/1", function (req, res) {
    req.session.login = "admin";
    req.session.role = 4;
    res.send("ok");
})

//Выход пользователя из системы
app.get("/out", function (req, res) {

    req.session.login = null;

    req.session.role = Roles.none;

    res.send({message: 'ok'});

})

// //Отправка роли активного пользователя
// app.get("/loginUserToken", function (req, res) {
//
//     return res.send(req.session.role);
//
// })

//Получение списка пользователей
app.get("/users", function (req, res) {

    if (!(req.session.role === Roles.admin || req.session.role === Roles.superuser)){
        return accessDenied(res, 'not right');
    }

    //Запрашивает список пользователя
    pull.query("select name as Name, surname as Surname, role as Role, login as Login from user where creatorLogin = ?" + (req.session.role === Roles.admin ? "or true" : ""), req.session.login)
        //     , function (errUsers, resultUsers, dataUsers) {
        //     if (errUsers){
        //         console.log(errUsers);
        //         let answer = new Answer();
        //         answer.statusCode = 404;
        //         answer.error = errUsers;
        //         res.statusCode = 404;
        //         res.send(answer);
        //     }
        //     resultUsers.forEach(function (user, i, resultUsers) {
        //         // console.log(item);
        //         let stationsStr = user['stationsId'];
        //         console.log(stationsStr);
        //         let stationInt = [];
        //         for (let i =0; i < stationsStr.length; i++){
        //             if (parseInt(stationsStr[i])){
        //                 if (stationInt.length === 0){
        //                     stationInt.push(parseInt(stationsStr[i]));
        //                 }
        //                 else {
        //                     stationInt[stationInt.length - 1] = 10 * stationInt.last() +  parseInt(stationsStr[i]);
        //                 }
        //             }
        //             else {
        //                 stationInt.push(0);
        //             }
        //         }
        //         console.log(stationInt);
        //         let sql = "select name, IMEI from station where id in (";
        //         for (let i = 0; i< stationInt.length - 1; i++){
        //             if (stationInt[i] !== 0){
        //                 sql += stationInt[i] + ", ";
        //             }
        //         }
        //         sql += stationInt.last() + ')';
        //         console.log(sql);
        //         pull.query(sql, function (errStations, resultStations, dateStations) {
        //
        //             if (errStations){
        //                 let answer = new Answer();
        //                 answer.statusCode = 405;
        //                 answer.error = errStations;
        //                 answer.name = user.name + user.surname;
        //                 res.statusCode = 405;
        //                 res.send(answer);
        //             }
        //             console.log(resultStations);
        //
        //             if (resultStations.length !== 0){
        //                 user.stations = resultStations;
        //             }
        //             else {
        //                 user.stations = false;
        //             }
        //             console.log(user);
        //         });
        //         console.log(user);
        //         //     .then(resultStations =>{
        //         //         console.log(resultStations[0]);
        //         //
        //         //     }).catch(err => {
        //         //     let answer = new Answer();
        //         //     answer.statusCode = 404;
        //         //     answer.error = err;
        //         //     return res.send(answer);
        //         // })
        //     });
        //     //res.send(resultUsers);
        // })
        .then(async (resultUsers) => {
            if (!resultUsers){
                throw 'empty db request';
            }
            // let promiseArray = [];
            // // console.log(resultUsers[0]);
            // resultUsers[0].forEach(function (user, i, resultUsers) {
            //     switch (user.Role) {
            //         case Roles.user:{
            //             user.Role = "user";
            //         }
            //             break;
            //         case Roles.superuser:{
            //             user.Role = "superuser";
            //         }
            //             break;
            //         case Roles.admin:{
            //             user.Role = "admin";
            //         }
            //             break;
            //         case Roles.none:{
            //             user.Role = "none";
            //         }
            //             break;
            //         default: {
            //             user.Role = "error";
            //         }
            //             break;
            //     }
            //     //console.log(user);
            //     let stationsStr = user['StationsId'];
            //     //console.log(stationsStr);
            //     const stationInt = strToIntWithIgnore(stationsStr);
            //     delete user.StationsId;
            //     //console.log(stationInt);
            //     const sql = formitareStationsIdSqlSearchString(stationInt);
            //     //console.log(sql);
            //     let pp = pull.query(sql)
            //         .then(resultStations =>{
            //             // console.log(resultStations[0]);
            //             return resultStations[0];
            //         })
            //     // .catch(err => {
            //     //     let answer = new Answer();
            //     //     answer.statusCode = 404;
            //     //     answer.error = err;
            //     //     return res.send(answer);
            //     // });
            //     promiseArray.push(pp);
            // });
            // Promise.all(promiseArray)
            //     .then(results => {
            //         //console.log(results);
            //         resultUsers[0].forEach(function (user, i, resultUsers) {
            //             //console.log(results[i][0]);
            //             user.StationName = [];
            //             user.IMEI = [];
            //             results[i].forEach(function (row, indexRow, results) {
            //                 //console.log(row);
            //                 if (!row){
            //                     //console.log("detected!");
            //                     row = {};
            //                     //console.log(results[i][0]);
            //                 }
            //
            //                 //console.log(row);
            //                 if (user && row && row.hasOwnProperty('Name') && row.hasOwnProperty('IMEI')){
            //                     //console.log('yes');
            //                     user.StationName.push(row.Name);
            //                     user.IMEI.push(row.IMEI);
            //                 }
            //                 else {
            //                     user.StationName = false;
            //                     user.IMEI = false;
            //                 }
            //             })
            //         })
            //         //console.log(resultUsers[0]);
            //         // res.send(resultUsers[0]);
            //         return processing(resultUsers[0], res, req);
            //     })
            //     .catch(error => {
            //         //return unknownError(req, res, error);
            //         let answer = new Answer();
            //         answer.statusCode = 404;
            //         answer.error = error;
            //         return res.send(answer);
            //     })
            let users = resultUsers[0];
            //console.log(resultUsers[0]);
            let promisesIMEI = [];

            for (let index_user = 0; index_user < users.length; index_user++) {
                let user = users[index_user];
                //console.log(user);
                switch (user.Role) {
                    case Roles.user: {
                        user.Role = "user";
                    }
                        break;
                    case Roles.superuser: {
                        user.Role = "superuser";
                    }
                        break;
                    case Roles.admin: {
                        user.Role = "admin";
                    }
                        break;
                    case Roles.none: {
                        user.Role = "none";
                    }
                        break;
                    default: {
                        user.Role = "error";
                    }
                        break;
                }
                await getStationsForUser(req, res, user);
                //promisesIMEI.push(promise);

            }
            //console.log(users);

            return processing(users, res, req);

            // let stationsIMEI = [];
            // let stationsName = [];
            //
            // //Получает список станций для каждого пользователя
            // await Promise.all(promisesIMEI)
            //     .then(stationsIMEIResult => {
            //         //console.log('ad');
            //         //console.log(stationsIMEIResult);
            //         let promisesName = [];
            //
            //         // const stations = stationsResult[0][0];
            //         // //console.log(stations);
            //         // let stationsIMEI = [];
            //         // let stationsName = [];
            //         // let promiseArray = [];
            //         // //let sql = 'select name as stationName from station where'
            //         // //console.log(stationsResult);
            //         // for (let index_station = 0; index_station < stations.length; index_station++) {
            //         //     // if (station){
            //         //     //     stations.push(station);
            //         //     // }
            //         //
            //         //     let stationIMEI = stations[index_station]['stationIMEI'];
            //         //
            //         //     console.log(stationIMEI);
            //         //     stationsIMEI.push(stationIMEI);
            //         //
            //         //     //sql += ' ' + stationIMEI + ' OR'
            //         //
            //         //     //Запрос станций по IMEI
            //         //     let sidePromise = pull.query(`select name as stationName from station where IMEI = ?`, stationIMEI);
            //         //     promiseArray.push(sidePromise);
            //         // }
            //         // //Обработка имён из ответов
            //         //
            //         // //Сделать без промисов
            //         //
            //         //
            //         // Promise.all(promiseArray)
            //         //     .then(sidePromisesResult => {
            //         //         for (let stationName in sidePromisesResult[0]) {
            //         //             if (!sidePromisesResult[0].hasOwnProperty(stationName)){
            //         //                 continue;
            //         //             }
            //         //
            //         //             stationsName.push(stationName);
            //         //
            //         //         }
            //         //
            //         //     })
            //         //     .catch(error => {
            //         //         return unknownError(req, res, error);
            //         //     })
            //         // //добавить массив к user
            //
            //         for (let index_IMEI = 0; index_IMEI < stationsIMEIResult.length; index_IMEI++){
            //             const userStationsIMEI = stationsIMEIResult[index_IMEI][0];
            //             //console.log(userStationsIMEI);
            //
            //             for (let index_name = 0; index_name < userStationsIMEI.length ; index_name++){
            //                 const stationIMEI = userStationsIMEI[index_name]['stationIMEI'];
            //                 //console.log(stationIMEI);
            //                 stationsIMEI.push(stationIMEI);
            //
            //                 let sidePromise = pull.query('select name as stationName from station where IMEI = ?', stationIMEI);
            //                 promisesName.push(sidePromise);
            //                 //console.log(sidePromise);
            //             }
            //         }
            //         return Promise.all(promisesName);
            //     })
            //     .then(stationNameSearch => {
            //         //console.log(stationNameSearch);
            //         for (let index_station = 0; index_station < stationNameSearch.length; index_station++){
            //             const stationName = stationNameSearch[index_station][0][0]['stationName'];
            //             //console.log(stationName);
            //             stationsName.push(stationName);
            //         }
            //     })
            //     .catch(error => {
            //         return unknownError(req, res, error);
            //     })
            // console.log(stationsIMEI);
            // console.log(stationsName);
            //
            // //Добавляем станцию пользователю
        })
        .catch(error => {
            return unknownError(req, res, error);
        })
})

// Добавление пользователя
app.post("/users/add", jsonParser, async function (req, res) {

    //Проверка прав доступа к функции
    if (!(req.session.role === Roles.admin || req.session.role === Roles.superuser)) {
        return accessDenied(res);
    }

    //Проверка существования данных
    if (!req.body
        || !req.body.Name || !req.body.Surname
        || !req.body.Email
        || !req.body.Login || !req.body.Password
        || !req.body.Role
        || !req.body.Station
    ) {
        // let answer = new Answer();
        // answer.statusCode = 400;
        // answer.error = "null object";
        // return res.status(400).send(answer);

        return notFoundData(res, req.body);
    }
    //console.log(req.body);

    const newUser = {
        login: req.body.Login,
        password: toCrypt(req.body.Password),
        role: req.body.Role,
        email: req.body.Email,
        name: req.body.Name,
        surname: req.body.Surname,
        stations: req.body.Station,
    }

    // Проверка на допустимость имени
    if (newUser.login.indexOf('?') !== -1) {
        return invalidName(res, newUser.login);
    }

    // Проверка роли
    if (!Roles.isIn(newUser.role)) {
        //console.log("da");
        let answer = new Answer();
        answer.statusCode = 404;
        answer.error = "Role";
        return res.status(400).send(answer);
    }
    //console.log(Roles[req.body.Role]);

    // Проверка корректности email
    if (!validateEmail.validate(newUser.email)) {
        let answer = new Answer();
        answer.statusCode = 404;
        answer.error = "email";
        return res.status(404).send(answer);
    }

    //Проверка на существование пользователя с данным логином или почтой
    await pull.query("select count(*) from user where login = ? or email = ?", [newUser.login, newUser.email])
        .then(searchResult => {
            if (!searchResult){
                throw 'empty db request';
            }
            if (searchResult[0][0]['count(*)'] !== 0) {
                throw searchResult[0][0];
            }
            let insertData = [newUser.name, newUser.surname, newUser.email, Roles[newUser.role], newUser.login, newUser.password, req.session.login];
            return pull.query("insert into user (`name`, `surname`, `email`, `role`, `login`, `password`, `creatorLogin`) values (?, ?, ?, ?, ?, ?, ?)", insertData)
        })
        .then(async (result) => {
            if (!result){
                throw 'empty db request';
            }
            console.log(`Создан новый пользователь: ${newUser.login}`);
            console.log('Добавление станций...');
            let promiseArray = [];
            for (let index_st = 0; index_st < newUser.stations.length; index_st++) {
                const station = newUser.stations[index_st]['IMEI'];
                if (await accessToStation(req.session.login, station, req.session.role)) {
                    console.log(`${req.session.login} может прикрепить станцию ${station} к ${newUser.login}`);
                } else {
                    console.log(`ОШИБКА: ${req.session.login} НЕ может прикрепить станцию ${station} к ${newUser.login}`)
                }
                let promise = pull.query("insert into `user-station` (stationIMEI, user) values (?, ?)", [station, newUser.login])
                promiseArray.push(promise);
            }
            return Promise.allSettled(promiseArray);
        })
        .then(insertResult => {
            if (!insertResult){
                throw 'empty db request';
            }
            //console.log(insertResult);
            let allCool = true;
            for (let indexRow = 0; indexRow < insertResult.length; indexRow++) {
                //console.log(insertResult[indexRow]['status']);
                if (insertResult[indexRow]['status'] === 'fulfilled' && insertResult[indexRow]['value'][0]['affectedRows'] > 0) {
                    console.log(`Стания ${newUser.stations[indexRow]['IMEI']} успешно добавлена пользователю ${newUser.login}`);
                } else {
                    console.log(`ОШИБКА: Стания ${newUser.stations[indexRow]['IMEI']} НЕ ДОБАВЛЕНА ПОЛЬЗОВАТЕЛЮ ${newUser.login}`);
                }
            }

            if (allCool) {
                let answer = new Answer();
                answer.statusCode = 201;
                answer.isCreated = true;

                return res.status(201).send(answer);
            } else {
                let answer = new Answer();
                answer.statusCode = 204;
                answer.error = 'not all stations have been added';
                answer.isCreated = true;

                return res.status(204).send(answer);
            }
        })
        .catch(error => {

            if (error['count(*)'] && error['count(*)'] !== 0) {
                let answer = new Answer();
                answer.statusCode = 400;
                answer.error = 'user already exist';

                return res.status(400).send(answer);
            } else throw error;
        })
        .catch(error => {
            return unknownError(req, res, error);
        })


    // //Проверка станций нового пользователя
    // let userStations = "";
    // const stations = req.body.StationName;
    // let arraySearchPromises = [];
    // for (let station of stations) {
    //     //console.log(station);
    //     let searchStationPromise = pull.query("select id from station where name = ?", station)
    //     arraySearchPromises.push(searchStationPromise);
    // }
    // Promise.all(arraySearchPromises)
    //     .then(searchResults => {
    //         //console.log(searchResults);
    //         for (let i = 0; i < searchResults.length; i++) {
    //             let row = searchResults[i][0][0];
    //             //console.log(row);
    //             if (!row.id) {
    //                 //console.log(row.id);
    //                 let answer = new Answer();
    //                 answer.statusCode = 404;
    //                 answer.error = "station";
    //                 return res.status(404).send(answer);
    //             }
    //             userStations += row.id + ' ';
    //
    //         }
    //         //console.log(userStations);
    //
    //         // Проверка на существование пользователя
    //         const dataToCheck = [req.body.Email, req.body.Login];//req.body.Name, req.body.Surname,
    //         pull.query("select count(*) as countRows from user where `email`=? or login = ?", dataToCheck)//`name` =? and `surname` =? or `email`=? or
    //             .then(searchResult => {
    //                 //console.log(searchResult[0]);
    //
    //                 if (searchResult[0][0]['countRows'] > 0) {
    //                     console.log(`Попытка создать пользователя с именем ${req.body.Name}, фамилией ${req.body.Surname}, почтой ${req.body.Email} и логином ${req.body.Login} Провалена: пользователь уже существует`);
    //                     let answer = new Answer();
    //                     answer.statusCode = 404;
    //                     answer.wasExist = true;
    //                     return res.status(404).send(answer);
    //                 }
    //
    //                 // Добавление пользователя
    //                 const userLogin = req.body.Login;
    //                 const userPassword = toCrypt(req.body.Password);
    //
    //                 const dataToAdd = [req.body.Name, req.body.Surname, req.body.Email, Roles[req.body.Role], userStations, userLogin, userPassword];
    //                 const sql = "insert into user (name, surname, email, role, stationsId, login, password) values (?,?,?,?,?,?,?)"
    //                 pull.query(sql, dataToAdd)
    //                     .then(addResult => {
    //                         //console.log(addResult);
    //                         let answer = new Answer();
    //                         answer.statusCode = 201;
    //                         answer.isCreated = true;
    //                         answer.name = req.body.Name + ' ' + req.body.Surname;
    //                         return res.send(answer);
    //                     })
    //                     .catch(error => {
    //                         return unknownError(req, res, error);
    //                     })
    //             })
    //             .catch(error => {
    //                 // console.log(error);
    //                 return unknownError(req, res, error);
    //             })
    //     })
    //     .catch(error => {
    //         return unknownError(req, res, error);
    //     })


})

// Получение пользователя по имени
app.get("/users/:login", async function (req, res) {
    const userLogin = req.params.login;

    //Проверка прав
    if (!await accessToUser(req.session.login, userLogin, req.session.role)) {
        return accessDenied(res, 'Not exist', 404);
    }

    //console.log(userLogin);
    pull.query("select name as Name, surname as Surname, email as Email, login as Login, role as Role from user where login = ?", userLogin)
        .then(async searchResult => {
            if (!searchResult){
                throw 'empty db request';
            }
            //console.log(searchResult[0]);
            //console.log(searchResult.length);
            // if (searchResult[0][0].length !== 0) {
            //
            //     // //console.log('a');
            //     // const stationsString = searchResult[0][0]['stationsId'];
            //     //
            //     // const stationInt = strToIntWithIgnore(stationsString);
            //     //
            //     // delete searchResult[0][0]['stationsId'];
            //     // //console.log(stationsString);
            //     // //console.log(stationInt);
            //     //
            //     // const sqlSearch = formitareStationsIdSqlSearchString(stationInt);
            //     //
            //     // pull.query(sqlSearch)
            //     //     .then(searchStationResult => {
            //     //         //console.log(searchStationResult[0]);
            //     //         searchResult[0][0].StationName = [];
            //     //         searchResult[0][0].IMEI = [];
            //     //         //console.log(searchStationResult[0][0]);
            //     //         for (let i = 0; i < searchStationResult[0].length; i++) {
            //     //             //console.log();
            //     //             const row = searchStationResult[0][i];
            //     //             searchResult[0][0].StationName.push(row.Name);
            //     //             searchResult[0][0].IMEI.push(row.IMEI);
            //     //         }
            //     //         //console.log(searchResult[0]);
            //     //
            //     //         return processing(searchResult[0], res, req);
            //     //     })
            //     //     .catch(error => {
            //     //         return unknownError(req, res, error);
            //     //     })
            //
            //     await getStationsForUser(req, res, searchResult[0][0]);
            //
            //     return res.send(searchResult[0]);
            //
            // } else {
            //     console.log(`Ошибка: Пользователя с логином ${userLogin} не существует`);
            //     let answer = new Answer();
            //     answer.statusCode = 404;
            //     answer.name = userLogin;
            //     answer.wasExist = false;
            //     return res.status(404).send(answer);
            // }
            await getStationsForUser(req, res, searchResult[0][0]);
            return res.send(searchResult[0]);
        })
        .catch(error => {
            return unknownError(req, res, error);
        })
})

// Обновление данных о пользователе
app.put("/users/:login/update", jsonParser, async function (req, res) {

    //Проверка на наличие файла
    if (!req.body) return res.sendStatus(400);

    // Проверка содержимого файла
    if (!req.body.old || !req.body.new
        || !req.body.old.Name || !req.body.old.Surname || !req.body.old.Email || !req.body.old.Login || !req.body.old.IMEI
        || !req.body.new.Name || !req.body.new.Surname || !req.body.new.Email || !req.body.new.Login || !req.body.new.IMEI) {
        return notFoundData(res, req.body);
    }

    console.log(req.body);

    //Проверка неизменность Login
    if (req.body.new.Login !== req.body.old.Login) {
        return invalidName(res, req.body.new.Login);
    }

    let updateUser = {
        Name: req.body.new.Name,
        Surname: req.body.new.Surname,
        Email: req.body.new.Email,
        Login: req.body.old.Login,
        StationsNEW: req.body.new.IMEI,
        StationsOLD: req.body.old.IMEI,
    }

    //Проверка прав
    if (!await accessToUser(req.session.login, updateUser.Login, req.session.role)) {
        return accessDenied(res);
    }

    let oldUser = {};

    let unkErr = false;
    let corrected = true;

    const userLogin = req.params.login;
    await pull.query("select name as Name, surname as Surname, email as Email, login as Login, role as Role from user where login = ?", userLogin)
        .then(async result => {
            if (!result){
                throw 'empty db request';
            }
            //console.log(result[0]);
            if (result[0].length !== 0) {
                await getStationsForUser(req, res, result[0][0]);
                oldUser = result[0][0];
            } else {

                corrected = false;
            }
        })
        .catch(error =>{
            unkErr = error;
        })

    if (unkErr){
        return unknownError(req, res, unkErr);
    }

    if (!corrected) {
        return invalidName(res, userLogin);
    }
    //console.log(oldUser);

    // console.log(req.body.old.Name !== oldUser.Name);
    // console.log(req.body.old.Login !== oldUser.Login);
    // console.log(req.body.old.Email !== oldUser.Email);
    // console.log(req.body.old.Surname !== oldUser.Surname);
    // console.log(!req.body.old.IMEI.equal(oldUser.IMEI));

    if (req.body.old.Name !== oldUser.Name
        || req.body.old.Login !== oldUser.Login
        || req.body.old.Email !== oldUser.Email
        || req.body.old.Surname !== oldUser.Surname
        || !req.body.old.IMEI.equal(oldUser.IMEI)) {
        console.log('Полученные данные и данные с сервера не совпадают!');
        return res.status(400).send({status: 400});
    }

    // Проверка корректности email
    if (!validateEmail.validate(updateUser.Email)) {
        console.log(`Ошибка: некорректный email: ${updateUser.Email}`);
        let answer = new Answer();
        answer.statusCode = 404;
        answer.error = "email";
        return res.status(404).send(answer);
    }

    //Формирут список станций для удаления из user

    let stationsDelete = [];
    let stationsDeleteOWN = [];
    for (let indexOLD = 0; indexOLD < updateUser.StationsOLD.length; indexOLD++) {
        let founded = false;
        for (let indexNEW = 0; indexNEW < updateUser.StationsNEW.length; indexNEW++) {
            if (updateUser.StationsOLD[indexOLD] === updateUser.StationsNEW[indexNEW]) {
                founded = true;
                break;
            }
        }
        if (!founded) {
            //stationsDelete.push(updateUser.StationOLD[indexOLD]);
            await pull.query("select max(if(IMEI = ? and ownerLogin = ?, 1, 0)) as isOwner from station", [updateUser.StationsOLD[indexOLD], updateUser.Login])
                .then(result => {
                    if (!result){
                        throw 'empty db request';
                    }
                    //console.log(result[0]);
                    if (result[0][0]['isOwner'] === 1) {
                        stationsDeleteOWN.push(updateUser.StationsOLD[indexOLD]);
                    } else {
                        stationsDelete.push(updateUser.StationsOLD[indexOLD]);
                    }
                    // let type = (result[0][0]['isOwner'] === 1) ? typeOwn.owner : typeOwn.use;
                    // stationsDelete.push({
                    //     type: type,
                    //     station: updateUser.StationsOLD[indexOLD],
                    // })
                })
                .catch(error => {
                    unkErr = error;
                })
            if (unkErr){
                return unknownError(req, res, unkErr);
            }
        }
    }
    console.log('На удаление');
    console.log(stationsDelete);

    console.log('На удаление с владением');
    console.log(stationsDeleteOWN);

    //Формирует список станций на добавление

    let stationsAdd = [];
    for (let iNEW = 0; iNEW < updateUser.StationsNEW.length; iNEW++) {
        let founded = false;
        for (let iOLD = 0; iOLD < updateUser.StationsOLD.length; iOLD++) {
            if (updateUser.StationsNEW[iNEW] === updateUser.StationsOLD[iOLD]) {
                founded = true;
                break;
            }
        }
        if (!founded) {
            stationsAdd.push(updateUser.StationsNEW[iNEW]);
        }
    }
    console.log('На добавление');
    console.log(stationsAdd);

    let isCorrected = true;

    //Обновление данных о пользователе
    const updateData = [updateUser.Name, updateUser.Surname, updateUser.Email, updateUser.Login]
    pull.query("update user set name = ?, surname = ?, email = ? where login = ?", updateData)
        .then(result => {
            if (!result){
                throw 'empty db request';
            }
            //console.log(result);
            if (result[0]['affectedRows'] > 0) {
                console.log(`Данные пользовталея ${updateUser.Login} обновлены`);
            } else {
                isCorrected = false;
                console.log(`ОШИБКА: данные пользователя ${updateUser.Login} НЕ обновлены`);
                throw result[0];
            }
            console.log(`Обновление списка станций`);

            if (stationsDelete.length === 0 && stationsAdd.length === 0 && stationsDeleteOWN.length === 0) {
                console.log('Обновление списка станций не требуется');
            }

            //Удаление старых станций
            if (stationsDelete.length !== 0) {
                console.log('Удаление станций из пользования...');
            }
            let promiseArray = [];
            for (let i = 0; i < stationsDelete.length; i++) {
                promiseArray.push(
                    pull.query('delete from `user-station` where stationIMEI = ? and user = ?', [stationsDelete[i], updateUser.Login])
                )
            }
            return Promise.allSettled(promiseArray);
        })
        .then(deleteResult => {
            if (!deleteResult){
                throw 'empty db request';
            }
            //console.log(deleteResult[0]['value'][0]['affectedRows']);
            for (let i = 0; i < deleteResult.length; i++) {
                if (deleteResult[i]['status'] === 'fulfilled' && deleteResult[0]['value'][0]['affectedRows'] > 0) {
                    console.log(`Стация ${stationsDelete[i]} успешно удалена из пользования ${updateUser.Login}`);
                } else {
                    isCorrected = false;
                    console.log(`ОШИБКА: стация ${stationsDelete[i]} НЕ УДАЛЕНА из пользования ${updateUser.Login}`);
                }

            }
            if (stationsDeleteOWN.length !== 0) {
                console.log('Удаление станций пользователя, которыми он владеет...');
            }

            let promiseArray = [];
            for (let i = 0; i < stationsDeleteOWN.length; i++) {
                promiseArray.push(
                    pull.query('update station set ownerLogin = ? where IMEI = ?', [req.session.login, stationsDeleteOWN[i]])
                )
            }
            return Promise.allSettled(promiseArray);
        })
        .then(deleteResult => {
            if (!deleteResult){
                throw 'empty db request';
            }
            //console.log(deleteResult[0]['value'][0]['affectedRows']);
            for (let i = 0; i < deleteResult.length; i++) {
                if (deleteResult[i]['status'] === 'fulfilled' && deleteResult[0]['value'][0]['affectedRows'] > 0) {
                    console.log(`Стация ${stationsDelete[i]} успешно перемещена от ${updateUser.Login} к ${req.session.login}`);
                } else {
                    isCorrected = false;
                    console.log(`ОШИБКА: стация ${stationsDelete[i]} НЕ ПЕРЕМЕЩЕНА от ${updateUser.Login} к ${req.session.login}`);
                }
            }
            if (stationsAdd.length !== 0) {
                console.log('Добавление новых станций');
            }

            let promiseArray = [];
            for (let i = 0; i < stationsAdd.length; i++) {
                promiseArray.push(
                    pull.query('insert into `user-station` (stationIMEI, user) values (?, ?)', [
                        stationsAdd[i],
                        updateUser.Login
                    ])
                )
            }
            return Promise.allSettled(promiseArray);
        })
        .then(insertResult => {
            if (!insertResult){
                throw 'empty db request';
            }
            for (let i = 0; i < insertResult.length; i++) {
                //console.log(insertResult[indexRow]['status']);
                if (insertResult[i]['status'] === 'fulfilled' && insertResult[i]['value'][0]['affectedRows'] > 0) {
                    console.log(`Стания ${stationsAdd[i]} успешно добавлена пользователю ${updateUser.Login}`);
                } else {
                    isCorrected = false;
                    console.log(`ОШИБКА: Стания ${stationsAdd[i]} НЕ ДОБАВЛЕНА ПОЛЬЗОВАТЕЛЮ ${updateUser.Login}`);
                }
            }
        })
        .then(() => {
            // console.log(result);
            // if (!result){
            //     throw 'empty db request';
            // }
            //res.send({message: 'ok'});
            if (isCorrected) {
                let answer = new Answer();
                answer.isCreated = true;
                answer.wasExist = true;
                answer.statusCode = 201;

                return res.status(201).send(answer);
            } else {
                let answer = new Answer();
                answer.isCreated = true;
                answer.wasExist = true;
                answer.statusCode = 204;
                answer.error = 'not all stations have been added/deleted';

                return res.status(204).send(answer);
            }
        })
        .catch(error => {
            if (error['affectedRows'] && error['affectedRows'] <= 0) {
                let answer = new Answer();
                answer.statusCode = 400;
                answer.error = 'error updating data';

                return res.status(400).send(answer);
            } else if (error['errno'] === 1062) {
                console.log('ОШИБКА: Повторяющаяся электронная почта');
                let answer = new Answer();
                answer.statusCode = 405;
                answer.isCreated = false;
                answer.wasExist = true;
                answer.error = 'duplicate email';

                return res.status(405).send(answer);
            } else {
                return unknownError(req, res, error);
            }
        })

})

// Удаление пользователя
app.delete("/users/:login/delete", async function (req, res) {
    //return res.send({status: true});
    const user = req.params['login'];
    //console.log(user);

    //Проверка прав
    if (!await accessToUser(req.session.login, user, req.session.role)) {
        return accessDenied(res);
    }

    pull.query("delete from user where login = ?", user)
        .then(result => {
            if (!result){
                throw 'empty db request';
            }
            //console.log(result[0]['affectedRows'] > 0);
            if (result[0]['affectedRows'] > 0) {
                console.log(`Пользователь ${user} успешно удалён пользователем ${req.session.login}`);

                let answer = new Answer();
                answer.isCreated = false;
                answer.wasExist = true;
                answer.statusCode = 200;

                return res.status(200).send(answer);
            } else {
                console.log(`ОШИБКА: пользователь ${user} НЕ УДАЛЁН пользователем ${req.session.login}`);

                let answer = new Answer();
                answer.isCreated = true;
                answer.wasExist = true;
                answer.statusCode = 404;

                return res.status(404).send(answer);
            }
        })
        .catch(error => {
            return unknownError(req, res, error);
        })
})

//добавляет в user массив станций user
async function getStationsForUser(req, res, user) {
    await pull.query('select st.name, st.IMEI from station as st where ownerLogin = ? OR (st.IMEI in (select stationIMEI from `user-station` where user = ?)) order by name', [user.Login, user.Login])
        .then(stationsResult => {
            const stations = stationsResult[0];
            //console.log(stations);
            // let stationsName = [];
            // let stationsIMEI = [];
            user.StationName = [];
            user.IMEI = [];
            for (let index = 0; index < stations.length; index++) {
                //console.log(stations[index]);
                user.StationName.push(stations[index]['name']);
                user.IMEI.push(stations[index]['IMEI']);
            }
            //console.log(user);
            return null;
        })
        .catch(error => {
            //return unknownError(req, res, error);
            report(req, error);
            return error;
        })
}

//Шифрование строки
function toCrypt(value) {
    return value;
}

//**********************************************************//
//************** КОНЕЦ РАБОТЫ С ПОЛЬЗОВАТЕЛЕМ **************//
//**********************************************************//


//-----------------------------------------------------------//


//****************************************************//
//***************** РАБОТА С ФАЙЛАМИ *****************//
//****************************************************//

const postParser = express.urlencoded({extended: false})

app.post("/upload", postParser, (req, res) => {
    console.log(req.body);
    return res.send(req.body.IMEI);
})

app.get("/2", (req, res) => {
    //const path = require("path");
    res.writeHead(200, {
        'Content-Type': 'text/html'

    })
    //res.setHeader('content-type', 'text/html');

    fs.createReadStream(__dirname + "/index.html").pipe(res);

    //
    // console.log(path.resolve(__dirname, "index.html"))
    //res.sendFile(__dirname + "/index.html", {encoding: "utf-8"});
    //res.sendFile('index.html');
})

//**********************************************************//
//***************** КОНЕЦ РАБОТЫ С ФАЙЛАМИ *****************//
//**********************************************************//

// app.get("/", function (req, res) {
//
//     return res.sendStatus(200);
// })

// app.listen(3000, function(){
//     console.log("Сервер ожидает подключения...");
// });

// создайте HTTPS-сервер
const server = https.createServer({key, cert}, app);

// запустите сервер на порту 8000
server.listen(3000, () => {
    console.log("Сервер прослушивает порт 3000 на https");
});

//Сравнение массивов
Array.prototype.equal = function (someArray) {

    if (!someArray || (!someArray.length && someArray.length !== 0)){
        return false;
    }

    if (this.length !== someArray.length) {
        return false;
    }

    for (let i = 0; i < this.length; i++) {
        if (someArray[i] !== this[i]) {
            return false;
        }
    }

    return true;
}

//проверка на существовании атрибута
Object.prototype.isIn = function (item) {

    if (!item){
        return false;
    }

    //console.log(item);
    for (let obj in this) {
        //console.log(obj);
        if (obj === item && obj !== 'isIn') {
            return true;
        }
    }
    return false;
}

//Веозращает последний элемент
Array.prototype.last = function () {
    if (this.length === 0)
        return [0];
    return this[this.length - 1];
}

//Проверка имени
function invalidName(res, name) {
    console.log('Неверная строка: ' + name);
    let answer = new Answer();
    answer.statusCode = 400;
    //answer.name = name;
    answer.error = "invalidName ";
    return res.status(400).send(answer);
}

//Формирует строку запроса для логгирования
function formDate(request, force = false) {
    let now = new Date();
    let day = now.getDay();
    let month = now.getMonth();
    let year = now.getUTCFullYear();
    let hour = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();
    // let data = `${hour}:${minutes}:${seconds} ${request.method} [[${request.url}]] ${request.get("user-agent")}`;
    // return data;
    let login = request.session.login ? request.session.login : 'Неавторизован';
    //if (!request.session.login) request.session.login = 'Неавторизован';
    if (force) {
        return `${day}.${month}.${year} ${hour}:${minutes}:${seconds} ${request.method} [[${request.url}]]` +
            ` ${request.session.login} (${request.sessionID}) ${request.get("user-agent")}`;
    }
    return `${hour}:${minutes}:${seconds} ${request.method} [[${request.url}]]` +
        ` ${request.session.login} (${request.sessionID}) ${request.get("user-agent")}`;
}

//Отправление ответа
function processing(result, response, request) {
    // console.log(result);
    //let answer = new Answer();
    //answer.statusCode = 200;
    //answer.content = result;
    console.log(`send ${result.length} messeges to ${request.session.login} [[${request.url}]]`);
    //console.log(answer);
    return response.send(result);
}

//Отправка ответа о недостаточности данных
function notFoundData(response, data) {
    console.log(`Ошибка: необнаружены необходимые данные: `);
    console.log(data);
    let answer = new Answer();
    answer.statusCode = 404;
    answer.wasExist = false;
    answer.error = 'dont exist data';
    return response.status(404).send(answer);
}

//Массив ролей
const Roles = Object.freeze({
    user: 1,
    superuser: 2,
    admin: 3,
    none: 0,
    error: -1,
})

//Логгирование и отправка ответа о неизвестной ошибке
function unknownError(request, response, error) {
    report(request, error);
    let answer = new Answer();
    answer.statusCode = 500;
    answer.error = "unknown error";
    return response.status(500).send(answer);
}

//Отчёт об ошибке
function report(request, error) {
    console.log('Произошла неизвестная ошибка! ');
    console.log(error);
    fs.appendFile("server.log", formDate(request, true) + " : " + error + '\n', function () {
        console.log('Отчёт сформирован в server.log');
    });
}

// //Формирует из строки массив значений
// function strToIntWithIgnore(stationsString) {
//     let stationInt = [];
//     for (let i = 0; i < stationsString.length; i++) {
//         if (parseInt(stationsString[i])) {
//             if (stationInt.length === 0) {
//                 stationInt.push(parseInt(stationsString[i]));
//             } else {
//                 stationInt[stationInt.length - 1] = 10 * stationInt.last() + parseInt(stationsString[i]);
//             }
//         } else {
//             stationInt.push(0);
//         }
//     }
//     return stationInt;
// }
//
// //Формирует int строку ID из String
// function formitareStationsIdSqlSearchString(stationInt) {
//     let sql = "select name as Name, IMEI from station where id in (";
//     for (let i = 0; i < stationInt.length - 1; i++) {
//         sql += stationInt[i] + ", ";
//     }
//     sql += stationInt.last() + ')';
//     return sql;
// }



//Отправляет сообщение об отсутствии доступа
function accessDenied(res, message = 'access denied', code = 403) {
    let answer = new Answer();
    answer.statusCode = code;
    answer.error = message;
    console.log(message);

    return res.status(code).send(answer);
}

//Определяет, имеет ли пользователь доступ к станции
async function accessToStation(user, station, role = Roles.none) {

    if (role === Roles.admin) return true;
    //console.log(user);
    //console.log(station);

    let access = false;
    await pull.query('select if (((select max(if((stationIMEI = ? and user = ?), 1, 0)) from `user-station`) = 1) or (select max(if((IMEI = ? and ownerLogin = ?), true, false)) from station), 1, 0) as access',
        [station, user, station, user])
        .then(result => {
            //console.log(result[0]);
            access = result[0][0]['access'];
        })
        .catch(error => {
            console.log(error);
        })
    //console.log(access);
    return access;
}

//Определяет, имеет ли пользователь доступ к выбранному пользователю
async function accessToUser(userOwner, user, role = Roles.none) {

    if (role === Roles.admin) return true;

    let access = false;
    await pull.query('select max(if((login = ? and creatorLogin = ?), 1, 0)) as access from user', [user, userOwner])
        .then(result => {
            access = result[0][0]['access'];
        })
        .catch(error => {
            console.log(error);
        })
    return access;
}

//Сравнивает содержимое объектов
Object.prototype.deepEqual = function (object) {
    // console.log(this);
    //
    // console.log(Object.keys(this).sort());
    //
    // console.log(object);
    //
    // return false;

    const obj1 = orderObj(this);
    const obj2 = orderObj(object);

    //console.log(obj1);
    //console.log(obj2);

    return (JSON.stringify(obj1) === JSON.stringify(obj2));
}

//Создаёт копию объекта с упорядочеными ключами
function orderObj(object) {
    if (!object){
        return {};
    }
    let newObj = {};
    Object.keys(object).sort().forEach(function (name) {
        newObj[name] = object[name];
    })
    return newObj;
}

//Проверяет сроку на число
function isNumber(value) {
    if(value instanceof Number)
        value = value.valueOf(); // Если это объект числа, то берём значение, которое и будет числом

    return  isFinite(value) && value === parseInt(value, 10);
}
