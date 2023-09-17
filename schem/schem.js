const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    money: Number,
    id: Number,
    isAdmin: Boolean,
    ticketBan: Boolean,
    repl: Number,
    purch: Number,
});

const itemSchema = new mongoose.Schema({
    name: String,
    image: String,
    price: Number,
    isActive: Boolean,
    section: String,
});

const sectionSchema = new mongoose.Schema({
    text: String,
})

const ticketSchema = new mongoose.Schema({
    text: String,
    author: Number,
    createdAt: {
        type: Date,
        default: Date.now
    },
    answer: String,
    isActive: Boolean,
})

const User = mongoose.model('User', userSchema)
const Item = mongoose.model('Item', itemSchema)
const Ticket = mongoose.model('Ticket', ticketSchema)
const Section = mongoose.model('Section', sectionSchema)

module.exports = { User, Item, Ticket, Section };