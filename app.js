
const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("server running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error : ${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

app.post("/register/",async (request,response)=>{
const { username,password,name,gender}=request.body
const query = `SELECT * FROM user WHERE username='${username}'`
const user = await db.get(query)

if(user===undefined){
    //create user
    if(password.length<6){
        response.status(400)
        response.send("Password is too short")
    }
    else{
        const hashedPass = await bcrypt.hash(password,10)
        const q = `INSERT INTO user (username,password,name,gender)
    VALUES ('${username}','${hashedPass}','${name}','${gender}')`
    await db.run(q)
    response.send("User created successfully")
    }
}
else{
    //already exsits
    response.send("User already exists")
}
})


app.post("/login/",async (request,response)=>{
const { username,password}=request.body
const query = `SELECT * FROM user WHERE username='${username}'`
const user = await db.get(query)

if(user===undefined){
    //invalid user
response.status(400)
response.send("Invalid user")
}
else{
    //check password
    const isPassValid = await bcrypt.compare(password,user.password)
    if(isPassValid){
        //create jwt token
        const payload = {username :username}
        const jwtToken = await jwt.sign(payload,"secret")
        response.send({jwtToken})
    }
    else{
        //invalid pass
        response.status(400)
        response.send("Invalid password")
    }
}
})

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    console.log(jwtToken);
  }
  if (jwtToken === undefined) {
    console.log(jwtToken);
    response.status(401);
    response.send("Invalid JWT Token");
    console.log("token not available");
  } else {
    console.log(jwtToken);
    console.log("else");

    jwt.verify(jwtToken, "secret", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
        console.log("wrong token");
      } else {
        request.username=payload.username  
        next();
      }
    });
  }
};

app.get("/user/tweets/feed/",authenticateToken, async (request, response) => {
 const {username}=request 
    const query = `SELECT * FROM user WHERE username='${username}'`
    const user = await db.get(query)
console.log(user)
const id = user.user_id    
        const query1 = `SELECT user.username,tweet,date_time as dateTime FROM 
        (follower JOIN tweet ON tweet.user_id=follower.following_user_id)
         AS T 
         JOIN user ON user.user_id=T.user_id
         WHERE follower_user_id=${id}
         ORDER BY dateTime ASC
         LIMIT 4`;
    const array1 = await db.all(query1)
    response.send(array1)
})

app.get("/user/following/",authenticateToken, async (request, response) => {
    const {username}=request 
    const query1 = `SELECT * FROM user WHERE username='${username}'`
    const user = await db.get(query1)
console.log(user)
const id = user.user_id 
        const query = `SELECT username FROM 
        user INNER JOIN follower ON user.user_id=follower.following_user_id
         WHERE follower.follower_user_id=${id}`
    const array = await db.all(query)
    response.send(array)
})

app.get("/user/followers/",authenticateToken, async (request, response) => {
     const {username}=request 
    const query1 = `SELECT * FROM user WHERE username='${username}'`
    const user = await db.get(query1)
console.log(user)
const id = user.user_id     
    
    const query = `SELECT user.username FROM 
        user INNER JOIN follower ON user.user_id=follower.follower_user_id
         WHERE following_user_id=${id}`
    const array = await db.all(query)
    response.send(array)
})

app.get("/tweets/:tweetId/",authenticateToken,async (request,response)=>{
    const {tweetId}=request.params 
    const {username} = request 
    const query1 = `SELECT * FROM user WHERE username='${username}'`
    const user = await db.get(query1)
    const id = user.user_id 
  const q = `SELECT tweet,count(DISTINCT like_id) as likes,count(DISTINCT reply_id) as replies,date_time as dateTime
   FROM (tweet t JOIN like l ON t.tweet_id=l.tweet_id) as G JOIN reply r ON G.tweet_id = r.tweet_id WHERE t.tweet_id=${tweetId}`
   const a = await db.all(q)    
    const query2 = `SELECT * FROM 
    tweet INNER JOIN follower ON tweet.user_id=follower.following_user_id
    WHERE follower_user_id=${id} AND tweet_id=${tweetId}`
    const tweet = await db.get(query2)
    console.log(tweet)
    if(tweet===undefined){
        response.status(401)
        response.send("Invalid Request")
    }
    else{
        response.send(a)
        }            
})

app.get("/tweets/:tweetId/likes/",authenticateToken,async (request,response)=>{
    const {tweetId}=request.params 
    const {username} = request 
    const query1 = `SELECT * FROM user WHERE username='${username}'`
    const user = await db.get(query1)
    const id = user.user_id 
    const query2 = `SELECT * FROM 
    tweet INNER JOIN follower ON tweet.user_id=follower.following_user_id
    WHERE follower_user_id=${id} AND tweet_id=${tweetId}`
    const tweet = await db.get(query2)
    console.log(tweet)
    const q = `SELECT name FROM user JOIN like ON user.user_id=like.user_id WHERE tweet_id=${tweetId}`
    const a = await db.all(q)
    if(tweet===undefined){
        response.status(401)
        response.send("Invalid Request")
    }
    else{
        response.send(a)
    //some users may not have tweets
    //can access only following tweets
}
})

app.get("/tweets/:tweetId/replies",authenticateToken,async (request,response)=>{
    const {tweetId}=request.params 
    const {username} = request 
    const query1 = `SELECT * FROM user WHERE username='${username}'`
    const user = await db.get(query1)
    const id = user.user_id 
    const query2 = `SELECT * FROM 
    tweet INNER JOIN follower ON tweet.user_id=follower.following_user_id
    WHERE follower_user_id=${id} AND tweet_id=${tweetId}`
    const tweet = await db.get(query2)
    console.log(tweet)
    const q = `SELECT name,reply FROM user JOIN reply ON user.user_id=reply.user_id WHERE tweet_id=${tweetId}`
    const a = await db.all(q)
    if(tweet===undefined){
        response.status(401)
        response.send("Invalid Request")
    }
    else{
    response.send({replies:a})        
    //some users may not have tweets
    //can access only following tweets
}
})

app.get("/user/tweets/",authenticateToken,async (request,response)=>{
    const {username}=request 
    const query1 = `SELECT * FROM user WHERE username='${username}'`
    const user = await db.get(query1)
console.log(user)
const id = user.user_id 
   const q = `SELECT tweet,count(DISTINCT like_id) as likes,count(DISTINCT reply_id) as replies,date_time as dateTime
   FROM (tweet t JOIN like l ON t.tweet_id=l.tweet_id) as G JOIN reply r ON G.tweet_id = r.tweet_id
   WHERE t.user_id=${id}
   GROUP BY t.tweet_id`
   const a = await db.all(q)
   response.send(a)
})

app.post("/user/tweets/",authenticateToken,async (request,response)=>{
     const {username} = request
    const {tweet}=request.body
    const query1 = `SELECT * FROM user WHERE username='${username}'`
    const user = await db.get(query1)
console.log(user)
const id = user.user_id
console.log(id)     
const q  =`INSERT INTO tweet (tweet,user_id,date_time) VALUES ('${tweet}',2,'2021-04-07 14:50:15')`
   const a = await db.run(q)
   response.send("Created a Tweet")
})

app.delete("/tweets/:tweetId/",authenticateToken,async (request,response)=>{
    const {username}=request 
    const {tweetId} = request.params
    const query1 = `SELECT * FROM user WHERE username='${username}'`
    const user = await db.get(query1)
console.log(user)
const id = user.user_id
console.log(id)
    const query2 = `SELECT * FROM tweet WHERE user_id=${id} AND tweet_id=${tweetId}`     
 
    const a = await db.get(query2)
if(a===undefined){
response.status(401)    
response.send("Invalid Request")    
}
else{
const qr = `DELETE FROM tweet WHERE tweet_id=${tweetId}`
const s = await db.run(qr)
response.send("Tweet Removed")
}
})


module.exports = app