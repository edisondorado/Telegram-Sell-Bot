const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const bot = new TelegramBot(process.env.TOKEN, { polling: true });

const { User, Ticket, Item, Section } = require('./schem/schem')
const connectToDatabase = require('./database/db');

const db = connectToDatabase();

const userContext = {};
const modTicket = {};
const newItem = {};

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const message = msg.text;
    const messageId = msg.message_id;
    if (userContext[msg.chat.id] === "create-ticket" || userContext[msg.chat.id] === "answer-ticket" || userContext[msg.chat.id] === "ban-ticket" || userContext[chatId] === "new-section" || userContext[chatId] === "price-item" || userContext[chatId] === "name-item") return;
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
    Section.find({})
        .then(sections => {
            sections.map(section => {
                if (query.data === section.text) {
                    newItem[chatId] = {};
                    newItem[chatId].section = section.text;
                    Item.find({ section: section.text })
                        .then(items => {
                            const itemButtons = items.map(item => ({
                                text: item.name,
                                callback_data: item.name
                            }));
                            const keyboard = [
                                [...itemButtons],
                                [{ text: "Добавить товар", callback_data: 'add-item' }, { text: "Назад", callback_data: 'shop' }]
                            ]
                            bot.editMessageText("Товары:", {
                                chat_id: chatId,
                                message_id: messageId,
                                reply_markup: {
                                    inline_keyboard: keyboard
                                }
                            })
                        })
                }
            })
        })
    Item.find({})
        .then(items => {
            items.map(item => {
                if (query.data === item.name) {
                    bot.editMessageText(`Товар: ${item.name}\nЦена: ${item.price}₽`, {
                        chat_id: chatId,
                        message_id: messageId,
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "Купить", callback_data: `${item.name}${item.price}` },
                                    { text: "Отмена", callback_data: 'shop' }
                                ]
                            ]
                        }
                    })
                }
                if (query.data === `${item.name}${item.price}`) {
                    User.find({ id: chatId })
                        .then(users => {
                            if (users.length > 0) {
                                const user = users[0];
                                const userMoney = parseInt(user.money);

                                if (!isNaN(userMoney) && userMoney >= item.price) {
                                    user.money = userMoney - item.price;
                                    user.save();
                                    bot.editMessageText("Предмет успешно куплен!", {
                                        chat_id: chatId,
                                        message_id: messageId,
                                        reply_markup: {
                                            inline_keyboard: [
                                                [
                                                    { text: "Назад", callback_data: "shop" }
                                                ]
                                            ]
                                        }
                                    });
                                } else {
                                    bot.editMessageText("Недостаточно средств для покупки данного товара!", {
                                        chat_id: chatId,
                                        message_id: messageId,
                                        reply_markup: {
                                            inline_keyboard: [
                                                [
                                                    { text: "Назад", callback_data: "shop" }
                                                ]
                                            ]
                                        }
                                    });
                                }
                            } else {
                                console.log("Пользователь не найден.");
                            }
                        })
                        .catch(e => {
                            console.error(e);
                        });

                }
            })
        })
    if (query.data === "menu") {
        menu(query.message)
    } else if (query.data === "shop") {
        Section.find({})
            .then(sections => {
                const sectionButtons = sections.map(section => ({
                    text: section.text,
                    callback_data: section.text
                }));
                const keyboard = [
                    [...sectionButtons],
                    [{ text: "Добавить раздел", callback_data: "add-section" }, { text: "Назад", callback_data: "menu" }],
                ];
                bot.editMessageText("Разделы:", {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: keyboard
                    }
                });
            })
            .catch(error => {
                console.error(error);
            });

    } else if (query.data === "add-section") {
        bot.editMessageText("Введите название раздела: ", {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "Отмена", callback_data: "shop" }
                    ]
                ]
            }
        })
        userContext[chatId] = "new-section"
        bot.once("message", msg => {
            if (userContext[chatId] !== "new-section") return;
            const newSection = new Section({
                text: msg.text,
            })
            newSection.save()
                .then(savedSection => {
                    if (savedSection) {
                        bot.deleteMessage(chatId, msg.message_id);
                        bot.editMessageText("Раздел успешно создан.", {
                            chat_id: chatId,
                            message_id: messageId,
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: "Назад", callback_data: "shop" }
                                    ]
                                ]
                            }
                        })
                        console.log('Section added to the database: ', savedSection);
                    }
                })
                .catch(e => {
                    console.error(e)
                })
        })
    } else if (query.data === "add-item") {
        bot.editMessageText("Введите название товара: ", {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "Отмена", callback_data: "shop" }
                    ]
                ]
            }
        })
        userContext[chatId] = "name-item";
        bot.on('message', msg => {
            if (userContext[chatId] !== "name-item") return;
            newItem[chatId].name = msg.text;
            bot.deleteMessage(chatId, msg.message_id);
            bot.editMessageText("Введите цену товара: ", {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "Отмена", callback_data: "shop" }
                        ]
                    ]
                }
            })
            userContext[chatId] = "price-item";
            bot.on('message', msg => {
                if (userContext[chatId] !== "price-item") return;
                newItem[chatId].price = msg.text;
                const addItem = new Item({
                    name: newItem[chatId].name,
                    price: newItem[chatId].price,
                    section: newItem[chatId].section,
                })
                addItem.save()
                    .then(savedItem => {
                        if (savedItem) {
                            bot.deleteMessage(chatId, msg.message_id);
                            bot.editMessageText("Товар успешно добавлен.", {
                                chat_id: chatId,
                                message_id: messageId,
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: "Назад", callback_data: "shop" }
                                        ]
                                    ]
                                }
                            })
                            console.log('Section added to the database: ', savedItem);
                        }
                    })
                    .catch(e => {
                        console.error(e)
                    })

            })
        })
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
                        userContext[chatId] = "create-ticket";
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
                            if (userContext[chatId] === 'create-ticket') {
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
        bot.editMessageText("Введите причину бана:", {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "Отмена", callback_data: "ticket_work" }
                    ]
                ]
            }
        })
        userContext[chatId] = "ban-ticket"
        bot.once("message", msg => {
            if (userContext[chatId] !== "ban-ticket") return;
            User.findOne({ id: modTicket[chatId].author })
                .then(user => {
                    user.ticketBan = true
                    user.save()
                    bot.sendMessage(user.id, `Доступ к тикетам был заблокирован модератором(<code>${msg.from.username}</code>).\nПричина: ${msg.text}`, { parse_mode: "HTML" })
                    bot.deleteMessage(chatId, msg.message_id);
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
                userContext[chatId] = "answer-ticket";
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
                    if (userContext[chatId] === 'answer-ticket') {
                        bot.sendMessage(ticket.author, `Модератор ответил на ваш тикет: \n\nОтвет: ${msg.text}`)
                            .then(() => {
                                bot.deleteMessage(chatId, msg.message_id);
                                ticket.isActive = false;
                                ticket.answer = msg.text;
                                ticket.save();
                                return bot.editMessageText("Вы успешно ответили на тикет.", {
                                    chat_id: chatId,
                                    message_id: messageId,
                                    reply_markup: {
                                        inline_keyboard: [
                                            [
                                                { text: "Продолжить", callback_data: "ticket_work" },
                                                { text: "Закончить", callback_data: "menu" }
                                            ]
                                        ]
                                    }
                                });
                            })
                    }

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