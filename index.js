const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const bot = new TelegramBot(process.env.TOKEN, { polling: true });

const { User, Ticket } = require('./schem/schem')
const connectToDatabase = require('./database/db');

const db = connectToDatabase();

const userContext = {};
const modTicket = {};

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const message = msg.text;
    const messageId = msg.message_id;
    if (userContext[msg.chat.id] === "ticket") return;
    if (msg.text === "/menu") {
        try {
            User.findOne({ id: msg.chat.id })
                .then(user => {
                    if (user) {
                        console.log("Found user: ", user.id)
                    } else {
                        const newUser = new User({
                            id: msg.chat.id,
                            money: 0,
                            isAdmin: false,
                            repl: 0,
                            purch: 0
                        })
                        newUser.save()
                            .then(savedUser => {
                                if (savedUser) {
                                    console.log('User added to the database: ', savedUser);
                                }
                            })
                            .catch(e => {
                                console.error(e)
                            })
                    }
                })
                .catch(err => {
                    console.error(err);
                })
            User.findOne({ id: msg.chat.id })
                .then(user => {
                    bot.sendMessage(chatId, "Выберите функцию:", {
                        reply_markup: {
                            inline_keyboard: user.isAdmin ? [
                                [
                                    { text: "Список товаров🎮", callback_data: 'shop' },
                                    { text: "Написать в поддержку🎧", callback_data: "support" },
                                ],
                                [
                                    { text: "Профиль👷", callback_data: "profile" },
                                    { text: "Тикеты💼", callback_data: "ticket_work" }
                                ]
                            ] : [
                                [
                                    { text: "Список товаров🎮", callback_data: 'shop' },
                                    { text: "Написать в поддержку🎧", callback_data: "support" },
                                ],
                                [
                                    { text: "Профиль👷", callback_data: "profile" }
                                ]
                            ]
                        },
                    });
                })
                .catch(err => {
                    console.error(err);
                })
        } catch (e) {
            console.log(e)
        }

    } else {
        bot.sendMessage(chatId, "Используйте /menu для получения основного меню");
    }
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    userContext[chatId] = "";
    if (query.data === "menu") {
        menu(query.message)
    } else if (query.data === "shop") {
        return bot.sendMessage(chatId, "You clicked Shop");
    } else if (query.data === "support") {
        bot.editMessageText("Перед тем как создать тикет, удостоверьтесь, что вы не можете исправить эту проблему без сторонний помощи:", {
            chat_id: chatId,
            message_id: messageId,
            reply_markup:
            {
                inline_keyboard:
                    [
                        [
                            { text: "Создать тикет", callback_data: 'ticket' },
                            { text: "Назад", callback_data: "menu" }
                        ]
                    ],
            },
        });
    } else if (query.data === "ticket") {
        try {
            User.findOne({ id: chatId })
                .then(user => {
                    if (user.ticketBan !== true) {
                        userContext[chatId] = "ticket";
                        bot.editMessageText("Введите вашу проблему:", {
                            chat_id: chatId,
                            message_id: messageId,
                            reply_markup:
                            {
                                inline_keyboard:
                                    [
                                        [
                                            { text: "Отмена", callback_data: "menu" }
                                        ]
                                    ],
                            },
                        });
                        bot.once('message', (msg) => {
                            if (userContext[chatId] !== "ticket") return;
                            try {
                                console.log(msg)
                                userContext[chatId] = "";
                                const newTicket = new Ticket({
                                    text: msg.text,
                                    author: msg.chat.id,
                                    isActive: true,
                                })
                                bot.deleteMessage(chatId, msg.message_id)
                                newTicket.save()
                                    .then(savedTicket => {
                                        if (savedTicket) {
                                            bot.editMessageText(`Тикет успешно создан, ожидайте ответа модерации.\n\nID: <code>${chatId}</code>\nТекст: ${savedTicket.text}\nВремя: ${savedTicket.createdAt}`, {
                                                chat_id: chatId,
                                                message_id: messageId,
                                                parse_mode: "HTML",
                                                reply_markup:
                                                {
                                                    inline_keyboard:
                                                        [
                                                            [
                                                                { text: "Обратно", callback_data: "menu" }
                                                            ]
                                                        ],
                                                },
                                            });
                                        }
                                    })
                                    .catch(e => {
                                        bot.editMessageText("Произошла ошибка при создании тикета, передайте информацию разработчикам.", {
                                            chat_id: chatId,
                                            message_id: messageId,
                                            reply_markup:
                                            {
                                                inline_keyboard:
                                                    [
                                                        [
                                                            { text: "Обратно", callback_data: "menu" }
                                                        ]
                                                    ],
                                            },
                                        });
                                    })
                            } catch (e) {
                                console.error(e)
                            }
                        })
                    } else {
                        bot.editMessageText("У вас имеется блокировка к тикетам.", {
                            chat_id: chatId,
                            message_id: messageId,
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: "Обратно", callback_data: "menu" }
                                    ]
                                ]
                            }
                        })
                    }
                })

        } catch (e) {
            console.error(e);
        }
    } else if (query.data === "ticket_work") {
        process_new_ticket(query)
    } else if (query.data === "ban") {
        User.findOne({ id: modTicket[chatId].author })
            .then(user => {
                user.ticketBan = true
                user.save()
                bot.sendMessage(user.id, 'Доступ к тикетам был заблокирован модератором.')
                bot.editMessageText(`Пользователь успешно заблокирован.`, {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "Назад", callback_data: "menu" }
                            ]
                        ]
                    }
                })
            })
    } else if (query.data === "profile") {
        const newText = 'Вы нажали на кнопку!';
        User.findOne({ id: chatId })
            .then(user => {
                bot.editMessageText(`Ваш ID профиля: <code>${chatId}</code>\nБаланс: ${user.money}₽\nВсего пополнения: ${user.repl}\nВсего покупок: ${user.purch}`, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [[{ text: "Назад", callback_data: "menu" }]],
                    },
                });
            })
            .catch(e => {
                console.error(e);
            })
    }
});

function process_new_ticket(query) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    Ticket.findOne({ isActive: true })
        .then(ticket => {
            if (ticket) {
                modTicket[chatId] = ticket;
                userContext[chatId] = "ticket";
                bot.editMessageText(`Тикет:\n\nID: <code>${ticket.author}</code>\nТекст: ${ticket.text}\nДата: ${ticket.createdAt}\n\nВведите ваш ответ:`, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "Заблокировать", callback_data: "ban" },
                                { text: "Закончить", callback_data: "menu" }
                            ]
                        ],
                    },
                });
                bot.once('message', (msg) => {
                    if (userContext[chatId] !== "ticket") return;
                    bot.sendMessage(ticket.author, `Модератор ответил на ваш тикет: \n\nОтвет: ${msg.text}`)
                        .then(() => {
                            bot.deleteMessage(chatId, msg.message_id);
                            ticket.isActive = false;
                            ticket.answer = msg.text;
                            return ticket.save();
                        })
                });
            } else {
                userContext[chatId] = "";
                bot.editMessageText(`Тикеты отсутствуют`, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "Назад", callback_data: "menu" }
                            ]
                        ],
                    },
                });
            }

        })
        .catch(e => {
            console.error(e);
        })
}

function menu(msg) {
    const chatId = msg.chat.id;
    const message = msg.text;
    const messageId = msg.message_id;
    User.findOne({ id: msg.chat.id })
        .then(user => {
            if (user) {
                console.log("Found user: ", user.id)
            } else {
                const newUser = new User({
                    id: msg.chat.id,
                    money: 0,
                    isAdmin: false,
                    repl: 0,
                    purch: 0
                })
                newUser.save()
                    .then(savedUser => {
                        if (savedUser) {
                            console.log('User added to the database: ', savedUser);
                        }
                    })
                    .catch(e => {
                        console.error(e)
                    })
            }
        })
        .catch(err => {
            console.error(err);
        })
    User.findOne({ id: msg.chat.id })
        .then(user => {
            bot.editMessageText("Выберите функцию:", {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: user.isAdmin ? [
                        [
                            { text: "Список товаров🎮", callback_data: 'shop' },
                            { text: "Написать в поддержку🎧", callback_data: "support" },
                        ],
                        [
                            { text: "Профиль👷", callback_data: "profile" },
                            { text: "Тикеты💼", callback_data: "ticket_work" }
                        ]
                    ] : [
                        [
                            { text: "Список товаров🎮", callback_data: 'shop' },
                            { text: "Написать в поддержку🎧", callback_data: "support" },
                        ],
                        [
                            { text: "Профиль👷", callback_data: "profile" }
                        ]
                    ]
                },
            });
        })
        .catch(err => {
            console.error(err);
        })
}