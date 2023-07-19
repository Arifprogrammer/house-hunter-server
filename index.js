const express = require("express");
require("dotenv").config();
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
let jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};

//* middlewares
app.use(cors(corsOptions));
app.use(express.json());

//* custom middlewares
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "unauthorize access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ error: true, message: "forbidden token" });
    }
    req.decoded = decoded;
    next();
  });
};

//* ingrating with mongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ketp048.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const usersCollection = client.db("houseHunter").collection("users");
    const housesCollection = client.db("houseHunter").collection("houses");
    const bookedCollection = client
      .db("houseHunter")
      .collection("bookedhouses");
    const signedInCollection = client
      .db("houseHunter")
      .collection("signedInUsers");
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();

    /* ---------------------------------------------------------
                          GET
    --------------------------------------------------------- */
    //! get registered user data in signin component
    app.get("/users", async (req, res) => {
      const query = req.query;
      const result = await usersCollection.findOne(query);
      if (result === null) {
        const updateResult = { email: result };
        return res.send(updateResult);
      }
      res.send(result);
    });

    //* getting total number of houses
    app.get("/totalhouses", async (req, res) => {
      const result = await housesCollection.estimatedDocumentCount();
      res.send({ totalHouses: result });
    });

    //* get all houses in home page
    app.get("/houses", async (req, res) => {
      const { page, limit } = req.query;
      const pageNumber = parseInt(page) || 0;
      const limitNumber = parseInt(limit) || 10;
      const skip = pageNumber * limitNumber;
      const result = await housesCollection
        .find()
        .skip(skip)
        .limit(limitNumber)
        .toArray();
      res.send(result);
    });

    //! get specific house data
    app.get("/houses/:id", async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const result = await housesCollection.findOne(query);
      res.send(result);
    });

    //! get booked houses
    app.get("/bookedhouse", async (req, res) => {
      const query = { renterEmail: req.query.email };
      const result = await bookedCollection.find(query).toArray();
      res.send(result);
    });

    //! get req to check the user role
    app.get("/user/role/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ student: false, admin: false, instructor: false });
      }
      const query = { email: email };
      const role = await usersCollection.findOne(query);
      const result = {
        renter: role?.role === "House Renter",
        owner: role?.role === "House Owner",
      };
      res.send(result);
    });

    //! get req from booked-house page
    app.get("/dashboard/bookedhouse", verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      if (email !== req.query.email) {
        return res
          .status(401)
          .send({ error: true, message: "unauthorize user" });
      }
      const filter = { renterEmail: email };
      const result = await bookedCollection.find(filter).toArray();
      res.send(result);
    });

    //! get req from manage houses page
    app.get("/dashboard/myhouses", verifyJWT, async (req, res) => {
      const query = { ownerEmail: req.query.email };
      const result = await housesCollection.find(query).toArray();
      console.log(result);
      res.send(result);
    });

    /* ---------------------------------------------------------
                          POST
    --------------------------------------------------------- */
    //? ---------------------JWT-----------------------
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "4h",
      });
      res.send({ token });
    });

    //! post req while creating new user
    app.post("/users", async (req, res) => {
      const data = req.body;
      const query = { email: data.email };
      const existingResult = await usersCollection.findOne(query);
      if (existingResult) {
        res.send({ user: "exist" });
      } else {
        const result = await usersCollection.insertOne(data);
        res.send(result);
      }
    });

    //! post req form booking page
    app.post("/bookhouse", verifyJWT, async (req, res) => {
      const result = await bookedCollection.insertOne(req.body);
      res.send(result);
    });

    /* ---------------------------------------------------------
                          PUT
    --------------------------------------------------------- */

    //! put req while signing in old user
    app.put("/signedinusers", async (req, res) => {
      const data = req.body;
      const query = { email: data.email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...data,
        },
      };
      const result = await signedInCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(result);
    });

    /* ---------------------------------------------------------
                          DELETE
    --------------------------------------------------------- */
    //! delete user while user logout
    app.delete("/signedinusers", async (req, res) => {
      const query = req.body;
      const result = await signedInCollection.deleteOne(query);
      res.send(result);
    });

    //! delete req from booked houses page
    app.delete("/dashboard/selected/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookedCollection.deleteOne(query);
      res.send(result);
    });

    //! delete req from manage houses page
    app.delete("/dashboard/selectedhouse/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await housesCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

//* testing the server
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
