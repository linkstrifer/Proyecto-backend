const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

mongoose.connect(process.env.MONGODB_URL || "mongodb://localhost:27017/chat", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on("error", (error) => {
  console.log(`MONGOOSE ERROR: ${error}`);
});

const MessageSchema = mongoose.Schema({
  channel: String,
  text: String,
  user: String,
  timestamp: {
    type: Date,
    default: new Date(),
  },
});

const MessageModel = mongoose.model("Message", MessageSchema);

const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const port = process.env.PORT || 8000;

app.use(cors());
app.use(bodyParser.json());

//## Endpoints

//### GET channel messages (primer nodo)

//- GET /api/channel/:channelId
// - { messages }

app.get("/channel/:id", (req, res) => {
  const { id } = req.params;

  MessageModel.find({ channel: id })
    .then((messages) => {
      res.status(200).json({ messages });
    })
    .catch((error) => {
      res.status(500).json({ error });
    });
});

//- POST /api/user/create

async function createMessage(message) {
  const { text, user, channel } = message;

  if (text && user) {
    return MessageModel.create({ user, text, channel })
      .then((result) => {
        io.emit("newMessage", result);
        return result;
      })
      .catch((error) => {
        return { error, status: 500 };
      });
  } else {
    return { error: "missing some parameters", status: 400 };
  }
}

app.post("/channel/:id", (req, res) => {
  const { id: channel } = req.params;
  const { text, user } = req.body;

  createMessage({ text, user, channel })
    .then((result) => res.status(200).json(result))
    .catch((error) => res.status(error.status).json(error));
});

//Sockets
io.on("connection", (socket) => {
  console.log("new connection sockets");

  socket.on("message", (message) => {
    createMessage(message);
  });
});

server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
