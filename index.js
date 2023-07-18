const express = require("express");
require("dotenv").config();
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
let jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");

const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};

//* middlewares
app.use(cors(corsOptions));
app.use(express.json());

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

    /* ---------------------------------------------------------
                          PUT
    --------------------------------------------------------- */

    //! put req while creating new user
    app.put("/users", async (req, res) => {
      const data = req.body;
      const query = { email: data.email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...data,
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

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
