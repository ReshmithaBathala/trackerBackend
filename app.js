const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const app = express();
app.use(express.json());
app.use(cors());
dotenv.config();
const PORT = process.env.PORT || 3002;
app.use(bodyParser.urlencoded({ extended: true }));
const dbPath = path.join(__dirname, "couriertracking.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(PORT, () => {
      console.log(`Server Running at http://localhost:${PORT}/`);
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

app.post("/register", async (request, response) => {
  const { username, password } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const userQuery = `
  SELECT * FROM users WHERE username='${username}';
  `;
  const dbUser = await db.get(userQuery);
  if (dbUser === undefined) {
    //create new user
    const newUser = `
    INSERT INTO users (username,password)
    VALUES ('${username}','${hashedPassword}');
    `;
    if (password.length < 5) {
      response.status(400);
      response.send("Password is too short");
    } else {
      await db.run(newUser);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    //user already exists
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM users WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

const authenticateKey = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.get("/", authenticateKey, async (request, response) => {
  const getShipmentQuery = `
    SELECT
      *
    FROM
      Shipments`;
  const shipmentsArray = await db.all(getShipmentQuery);
  response.send(shipmentsArray);
});

app.post("/courier/", authenticateKey, async (request, response) => {
  const courierDetails = request.body;
  const {
    TrackingNumber,
    SenderName,
    SenderAddress,
    RecipientName,
    RecipientAddress,
    PackageDescription,
    Status,
    LastUpdated,
  } = courierDetails;
  const addCourierQuery = `
INSERT INTO 
Shipments (TrackingNumber, SenderName, SenderAddress, RecipientName, RecipientAddress, PackageDescription, Status, LastUpdated)
VALUES (
    '${TrackingNumber}',
    '${SenderName}',
    '${SenderAddress}','${RecipientName}','${RecipientAddress}','${PackageDescription}','${Status}',
    '${LastUpdated}'
);
  `;
  const dbResponse = await db.run(addCourierQuery);
  response.send("Added successfully");
});

app.put("/courier/:courierId", authenticateKey, async (request, response) => {
  const courierId = request.params;
  const courierDetails = request.body;
  const {
    TrackingNumber,
    SenderName,
    SenderAddress,
    RecipientName,
    RecipientAddress,
    PackageDescription,
    Status,
    LastUpdated,
  } = courierDetails;
  const updateCourierQuery = `
UPDATE  
Shipments SET
   TrackingNumber= '${TrackingNumber}',
    SenderName='${SenderName}',
    SenderAddress='${SenderAddress}',RecipientName='${RecipientName}',RecipientAddress='${RecipientAddress}',
   PackageDescription='${PackageDescription}',Status='${Status}',
    LastUpdated='${LastUpdated}'
    WHERE TrackingNumber='${courierId}'
;
  `;
  await db.run(updateCourierQuery);
  response.send("Updated successfully");
});

app.delete(
  "/courier/:courierId",
  authenticateKey,
  async (request, response) => {
    const { courierId } = request.params;
    const deleteCourierQuery = `
    DELETE FROM
      Shipments
    WHERE
      TrackingNumber = ${courierId};`;
    await db.run(deleteCourierQuery);
    response.send("Courier Delivery Deleted Successfully");
  }
);

module.exports = app;
