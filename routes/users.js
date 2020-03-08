const auth = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const { User, validate, populateWords } = require("../models/user");
const { Word } = require("../models/wordlist");
const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const { getWords, getExpandedWords } = require("../utils/word-helper");
const jwt = require("jsonwebtoken");
const _ = require("lodash");

router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  res.send(user);
});

router.post("/login", async (req, res) => {
  let user;

  try {
    user = await User.findOne({ email: req.body.email });
  } catch (err) {
    return res.status(500).send({ message: "Login failed, try again later." });
  }

  if (!user) return res.status(404).send({ message: "User not found." });

  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(req.body.password, user.password);
  } catch (err) {
    return res.status(500).send({ message: "Login failed, try again later." });
  }

  if (!isValidPassword)
    return res.status(403).send({ message: "Email or password is incorrect." });

  let token;
  try {
    token = jwt.sign(
      { _id: user._id, email: user.email },
      process.env.JWT_PRIVATE_KEY,
      { expiresIn: "1h" }
    );
  } catch (err) {
    return res.status(500).send({ message: "Login failed, try again later." });
  }

  res.json({
    _id: user._id,
    email: user.email,
    name: user.name,
    token
  });
  // console.log(_.pick(user, ["_id", "name", "email"]));
  //  res
  //  .header("x-auth_token", token)
  // .send(_.pick(user, ["_id", "name", "email"]));
});

router.post("/", async (req, res) => {
  const { error } = validate(req.body);
  if (error) return res.status(400).send({ message: "Invalid inputs." });

  let user = await User.findOne({ email: req.body.email });
  if (user) return res.status(400).send({ message: "Email already in use." });

  user = new User(_.pick(req.body, ["name", "email", "password"]));
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
  user.words = populateWords();

  await user.save();

  const token = user.generateAuthToken();
  res.json({
    _id: user._id,
    email: user.email,
    name: user.name,
    token
  });
  //res
  // .header("x-auth_token", token)
  // .send(_.pick(user, ["_id", "name", "email"]));
});

router.get("/words/info", auth, async (req, res) => {
  const user = await User.findById(req.user._id);
  
  const wordInfo = {readyToLearn: 0, readyToReview: 0, learned: 0, mastered: 0, words: 0};
  
  user.words.forEach((word)=>{
	 wordInfo.words++; 
	 if (word.level === 4)
		 wordInfo.mastered++;
	 else if (word.level > 0)
		 wordInfo.learned++;
	 if (new Date(word.nextDate) < new Date()) 
	 {
		 if (word.level > 0)
			 wordInfo.readyToReview++;
		 else
			 wordInfo.readyToLearn++;
	 }
  });
  res.send({ wordInfo:  wordInfo});
});

router.get("/words/:numOfWords", auth, async (req, res) => {
  const user = await User.findById(req.user._id); //.select("-password");
  const words = getWords(user.words, req.params.numOfWords);
  res.send(words);
});

router.get("/words", auth, async (req, res) => {
  const user = await User.findById(req.user._id);
  // .populate({
  //   path: "words",
  //   model: "Word"
  // });
 const expandedWords = await getExpandedWords(user.words);

  res.send({ words:  expandedWords});
});


router.patch("/words/word/:wordNum", async (req, res) => {
  const user = await User.findById(req.user._id);
  const word = user.words[req.params.wordNum];
  changeWordLevel(word);
  await user.save();
  res.send(word);
});

module.exports = router;
