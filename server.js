const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const shortid = require('shortid');
const cors = require('cors');
const sift = require('sift');

const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useCreateIndex: true }, (err, db) => {
  if (err) console.log(`Error`, err);
  console.log(`Connected to MongoDB`);
});

const Schema = mongoose.Schema;
const userSchema = new Schema({
  username: {type: String, required: true, index: { unique: true }},
  _id: {type: String, required: true},
  log: [{
    description: {type: String, required: true},
    duration: {type: Number, required:true},
    date: {type: Date, default: Date.now()}
  }]
});

const User = mongoose.model("User", userSchema);

app.use(cors());

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());


app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});
//new user

app.post("/api/exercise/new-user", function (req, res, next) {
  
  const username = req.body.username;
  
  User.findOne({"username":username}, (err, data) => {
    if (err) {
      next(err);
    }
    if (data) {
      next({message:"This Username Is Taken. Please Use a Different Username."});
    } else {
      const record = new User({
        username: username, 
        _id: shortid.generate() 
      });
      console.log(record);
        record.save(function (err, data) {
          if(err) next(err);
          res.json({ username: data.username, _id: data._id });
        });
    }
  });
});

//add exercise
app.post("/api/exercise/add", function(req, res, next) {
  
  const userId = req.body.userId;
  const description = req.body.description;
  const duration = req.body.duration;
  const date = req.body.date ? new Date(req.body.date).toISOString().slice(0,10) : new Date().toISOString().slice(0,10);

  console.log("today" + date);
  User.findById({"_id":userId}, (err, data) => {
    if (err) {
      next(err);
    }
    if (data) { 
      const user = data.username;
      const recordLog = {
        description: description,
        duration: duration,
        date: date
      };
      User.updateOne({"_id":userId}, {$push: {"log":recordLog}}, {upsert:true, new:true}, (err, data1) => {
        if (err) {
          next(err);
        }
        if (data1) {
          console.log(data);
          res.json({"username":user, "_id":userId, description: description, duration: duration, date: date});
        }
      });
    } else {
      next({message:"User does not exist. Please register a new user."});
    }
  });
  
});

//display all users
app.get("/api/exercise/users", function (req, res, next) {
  console.log('users');
  
    User.find({}, {log:false,__v:false}).exec((err, data) => {
      if (err) { 
        next(err);
      }
      res.json(data);
    });
  });

//full exercise log
app.get("/api/exercise/log", function (req, res, next) {  
  const id = req.query.userId;
  User.findOne({_id:id}, (err, data) => {
    if (err) next(err);
    if (data) {
      const from = req.query.from ? new Date(req.query.from) : new Date("1970-01-01");
      const to = req.query.to ? new Date(req.query.to) : new Date();
      let limit = req.query.limit ? Number(req.query.limit) : data.log.length;
      if (limit === 0) {
        limit = data.log.length;
      }
     //console.log(limit);
      if (from == "Invalid Date") {
        next({message:"Parameter 'from' in the query is invalid."});
      } else
      if (to == "Invalid Date") {
        res.send({message:"Parameter 'to' in the query is invalid."});
      } else
      if (isNaN(limit)) {
        next({message:"Please use an integer number for the limit parameter."});
      } else {
      let log = data.log;
      //console.log(log);
      log = log.filter(x => (x.date >= from) && (x.date <= to)).map(val => {
        var newLog = {};
        newLog.date = val.date.toISOString().slice(0,10);
        newLog.description = val.description;
        newLog.duration = val.duration;
        return newLog;
      });
      if (limit<=log.length) {
        log = log.slice(0,limit);
      }
      
      const result = {
        "_id": data._id,
        "username": data.username,
        "total count":log.length,
        "log": log
      };
      //console.log(result);
      res.json(result);
      }
    } else {
      next({message:"User does not exist. Please register a new user."});
    }
    
  });
  //console.log(id);
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
