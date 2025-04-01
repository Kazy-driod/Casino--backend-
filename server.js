const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/casino', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const User = mongoose.model('User', new mongoose.Schema({
  name: String,
  phone: String,
  userId: { type: String, unique: true },
  balance: { type: Number, default: 0 }
}));

const Transaction = mongoose.model('Transaction', new mongoose.Schema({
  userId: String,
  type: String, // 'deposit', 'withdrawal', 'bet'
  amount: Number,
  status: String,
  date: { type: Date, default: Date.now }
}));

const Bet = mongoose.model('Bet', new mongoose.Schema({
  userId: String,
  game: String,
  betAmount: Number,
  outcome: String, // 'win' or 'lose'
  payout: Number,
  date: { type: Date, default: Date.now }
}));

const generateUserId = () => 'USER-' + Math.floor(Math.random() * 1000000);

app.post('/api/register', async (req, res) => {
  const { name, phone } = req.body;

  const existingUser = await User.findOne({ phone });
  if (existingUser) return res.json({ success: false, message: 'User already exists' });

  const newUser = new User({ name, phone, userId: generateUserId() });
  await newUser.save();

  res.json({ success: true, message: 'User registered', user: newUser });
});

app.post('/api/deposit', async (req, res) => {
  const { userId, amount } = req.body;
  const user = await User.findOne({ userId });

  if (!user) return res.json({ success: false, message: 'User not found' });

  const depositCharge = Math.floor(amount / 1000) * 50;
  const finalAmount = amount - depositCharge;

  user.balance += finalAmount;
  await user.save();

  const transaction = new Transaction({ userId, type: 'deposit', amount, status: 'approved' });
  await transaction.save();

  res.json({ success: true, message: `Deposited ${finalAmount}`, balance: user.balance });
});

app.post('/api/withdraw', async (req, res) => {
  const { userId, amount } = req.body;
  const user = await User.findOne({ userId });

  if (!user) return res.json({ success: false, message: 'User not found' });
  if (amount < 1000) return res.json({ success: false, message: 'Minimum withdrawal is 1000' });
  if (amount % 100 !== 0) return res.json({ success: false, message: 'Withdrawal must be in multiples of 100' });

  const withdrawalCharge = Math.floor(amount / 1000) * 50;
  const finalAmount = amount - withdrawalCharge;

  if (user.balance < amount) return res.json({ success: false, message: 'Insufficient balance' });

  user.balance -= amount;
  await user.save();

  const transaction = new Transaction({ userId, type: 'withdrawal', amount, status: 'approved' });
  await transaction.save();

  res.json({ success: true, message: `Withdrawn ${finalAmount}`, balance: user.balance });
});

app.post('/api/bet', async (req, res) => {
  const { userId, game, betAmount } = req.body;
  const user = await User.findOne({ userId });

  if (!user) return res.json({ success: false, message: 'User not found' });
  if (betAmount < 100 || betAmount % 100 !== 0) return res.json({ success: false, message: 'Bet amount must be a multiple of 100' });
  if (user.balance < betAmount) return res.json({ success: false, message: 'Insufficient balance' });

  const outcome = Math.random() < 0.5 ? 'win' : 'lose';
  let payout = 0;

  if (outcome === 'win') {
    payout = betAmount * 2;
    user.balance += payout;
  } else {
    user.balance -= betAmount;
  }

  await user.save();

  const bet = new Bet({ userId, game, betAmount, outcome, payout });
  await bet.save();

  res.json({ success: true, message: `Bet placed on ${game}`, outcome, payout, balance: user.balance });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
