const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cewig2g.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("ticketBari");
    const usersCollection = db.collection("users");
    const ticketCollection = db.collection("added-ticket");

    // Users Related API
    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "user";
      user.createAt = new Date();

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // Users get
    // app.get("/users", async (req, res) => {
    //   const result = await usersCollection.findOne();
    //   res.send(result);
    // });

    // Users Role
    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ role: user?.role || "user" });
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });

    // Ticket Create API
    app.post("/added-ticket", async (req, res) => {
      const ticket = req.body;
      const price = ticket.price;
      const quantity = ticket.quantity;
      // ticket Create Time
      ticket.createAt = new Date();
      ticket.date = new Date(ticket.date);
      ticket.status = "pending";
      ticket.price = Number(price);
      ticket.quantity = Number(quantity);
      const result = await ticketCollection.insertOne(ticket);
      res.send(result);
    });

    // Get Tickets by Vendor
    app.get("/added-ticket", async (req, res) => {
      const email = req.query.email;
      const result = await ticketCollection
        .find({ vendorEmail: email })
        .toArray();
      res.send(result);
    });
    // Ticket delete api
    app.delete("/added-ticket/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await ticketCollection.deleteOne(query);
      res.send(result);
    });
    // Ticket Update Api
    app.patch("/added-ticket/:id", async (req, res) => {
      const id = req.params.id;
      const updates = req.body;
      if (updates.date) updates.date = new Date(updates.date);

      try {
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: updates };

        const result = await ticketCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Ticket not found" });
        }

        res.send({ message: "Ticket updated successfully", result });
      } catch (error) {
        res.status(500).send({ message: "Error updating ticket", error });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Ticketbari-booking-platform is running !");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
