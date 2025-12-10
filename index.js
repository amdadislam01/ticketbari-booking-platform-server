const express = require("express");
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_GET);
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
    const bookTicketCollection = db.collection("booking");
    const paymentCollection = db.collection("payment");

    // Create User
    app.post("/users", async (req, res) => {
      const user = req.body;
      const existingUser = await usersCollection.findOne({ email: user.email });
      if (existingUser) {
        return res.status(400).send({ message: "User already exists" });
      }
      user.role = "user";
      user.createdAt = new Date();

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // Get User Role
    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      res.send({ role: user?.role || "user" });
    });

    // Get Single User
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      res.send(user);
    });
    // Get All Users
    app.get("/users", async (req, res) => {
      const cursor = usersCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    // Users Update Role API
    app.patch("/users/:id/role", async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;
      const query = { _id: new ObjectId(id) };

      await usersCollection.updateOne(query, { $set: { role } });

      if (role === "fraud") {
        await ticketCollection.updateMany(
          { vendorId: id },
          { $set: { status: "hidden" } }
        );
      }

      res.send({ message: "Role updated & fraud process completed!" });
    });

    // Update Users
    app.patch("/users/:email", async (req, res) => {
      const email = req.params.email;
      const { displayName, photoURL } = req.body;
      const filter = { email };
      const updateDoc = {
        $set: {
          displayName,
          photoURL,
          updatedAt: new Date(),
        },
      };

      try {
        const result = await usersCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send({
          success: true,
          message: "Profile updated successfully in database",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error("DB Update Error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // Create Ticket
    app.post("/added-ticket", async (req, res) => {
      const ticket = req.body;
      const user = await usersCollection.findOne({ email: ticket.vendorEmail });

      if (user?.role === "fraud") {
        return res.status(403).send({
          success: false,
          message: "You are marked as FRAUD. You cannot add new tickets.",
        });
      }

      ticket.vendorId = user._id.toString();
      ticket.createAt = new Date();
      ticket.date = new Date(ticket.date);
      ticket.status = "pending";
      ticket.price = Number(ticket.price);
      ticket.quantity = Number(ticket.quantity);

      const result = await ticketCollection.insertOne(ticket);
      res.send(result);
    });

    // Get Tickets by Vendor
    app.get("/added-ticket", async (req, res) => {
      const email = req.query.email;

      const user = await usersCollection.findOne({ email });
      if (user?.role === "fraud") {
        return res.send([]);
      }
      const result = await ticketCollection
        .find({ vendorEmail: email })
        .toArray();
      res.send(result);
    });

    // Get Pending Tickets
    app.get("/added-ticket/pending", async (req, res) => {
      const result = await ticketCollection
        .find()
        .sort({ createAt: -1 })
        .toArray();
      res.send(result);
    });

    // Get Approved Tickets
    app.get("/added-ticket/approved", async (req, res) => {
      const result = await ticketCollection
        .find({ status: "approved" })
        .sort({ createAt: -1 })
        .toArray();
      res.send(result);
    });

    // Details Get API
    app.get("/added-ticket/approved/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await ticketCollection.findOne(query);
      res.send(result);
    });

    // Update Ticket Status
    app.patch("/added-ticket/status/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;

      const result = await ticketCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );

      res.send(result);
    });

    // Update Ticket
    app.patch("/added-ticket/update/:id", async (req, res) => {
      const id = req.params.id;
      const updates = req.body;

      if (updates.date) updates.date = new Date(updates.date);

      const result = await ticketCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updates }
      );

      res.send(result);
    });

    // Delete Ticket
    app.delete("/added-ticket/:id", async (req, res) => {
      const id = req.params.id;
      const result = await ticketCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Booking Ticket
    app.post("/booking", async (req, res) => {
      const { ticketId, ticketDate, quantity, ...rest } = req.body;
      const date = new Date(ticketDate);

      // Check ticket
      const ticket = await ticketCollection.findOne({
        _id: new ObjectId(ticketId),
      });
      if (!ticket) {
        return res
          .status(404)
          .send({ success: false, message: "Ticket not found" });
      }

      if (ticket.quantity < quantity) {
        return res.status(400).send({
          success: false,
          message: "Not enough tickets available",
        });
      }

      //  ticket quantity
      await ticketCollection.updateOne(
        { _id: new ObjectId(ticketId) },
        { $inc: { quantity: -quantity } }
      );

      //  user-specific ticket booking
      const existBookingTicket = await bookTicketCollection.findOne({
        ticketId,
        userEmail: rest.userEmail,
      });

      let result;
      if (existBookingTicket) {
        result = await bookTicketCollection.updateOne(
          { ticketId, userEmail: rest.userEmail },
          { $inc: { quantity: quantity } }
        );
      } else {
        result = await bookTicketCollection.insertOne({
          ticketId,
          ticketDate: date,
          quantity,
          ...rest,
        });
      }

      res.send({ success: true, result });
    });

    // Booking Ticket get API
    app.get("/booking", async (req, res) => {
      const userEmail = req.query.email;

      if (!userEmail) {
        return res.status(400).send({
          success: false,
          message: "Email is required",
        });
      }

      const result = await bookTicketCollection.find({ userEmail }).toArray();
      res.send(result);
    });

    // All ticket
    app.get("/booking/all", async (req, res) => {
      const result = await bookTicketCollection.find().toArray();
      res.send(result);
    });

    // Get Pending Booking Tickets
    app.get("/booking/pending", async (req, res) => {
      const result = await bookTicketCollection
        .find()
        .sort({ createAt: -1 })
        .toArray();
      res.send(result);
    });

    // Booking ticket Id Find
    app.get("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookTicketCollection.findOne(query);
      res.send(result);
    });

    // Update booking Ticket Status
    app.patch("/booking/status/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;

      const result = await bookTicketCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );

      res.send(result);
    });

    // Update Booking Ticket
    app.patch("/booking/update/:id", async (req, res) => {
      const id = req.params.id;
      const updates = req.body;

      if (updates.date) updates.date = new Date(updates.date);

      const result = await bookTicketCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updates }
      );

      res.send(result);
    });

    // Payment Related API
    app.post("/checkout-payment", async (req, res) => {
      try {
        const paymentInfo = req.body;
        const amount = parseInt(paymentInfo.totalPrice) * 100;

        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: "USD",
                unit_amount: amount,
                product_data: {
                  name: `Please pay for: ${paymentInfo.title}`,
                },
              },
              quantity: 1,
            },
          ],
          customer_email: paymentInfo.senderEmail,
          mode: "payment",
          metadata: {
            ticketId: paymentInfo.ticketId,
            ticketName: paymentInfo.title,
          },
          success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled`,
        });

        console.log(session);
        res.send({ url: session.url });
      } catch (error) {
        console.error("PAYMENT ERROR:", error);
        res.status(500).send({ message: error.message });
      }
    });
    // Payment success Api
    app.patch("/payment-success", async (req, res) => {
      try {
        const sessionId = req.query.session_id;
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const transactionId = session.payment_intent;
        
        const query = { transactionId: transactionId };

        const existing = await paymentCollection.findOne(query);
        
        if (existing) {
          return res.send({
            message: "Payment already saved",
            transactionId,
          });
        }
        if (session.payment_status !== "paid") {
          return res.send({ success: false, message: "Payment not completed" });
        }
        await bookTicketCollection.updateOne(
          { _id: new ObjectId(session.metadata.ticketId) },
          { $set: { status: "paid" } }
        );

        const payment = {
          amount: session.amount_total / 100,
          currency: session.currency,
          customerEmail: session.customer_email,
          ticketId: session.metadata.ticketId,
          ticketName: session.metadata.ticketName,
          transactionId,
          paymentStatus: session.payment_status,
          paidAt: new Date(),
        };
        let savedPayment;

        try {
          savedPayment = await paymentCollection.insertOne(payment);
        } catch (err) {
          if (err.code === 11000) {
            return res.send({
              success: true,
              message: "Payment already saved",
              transactionId,
            });
          }
          throw err;
        }

        return res.send({
          success: true,
          message: "Payment processed successfully",
          transactionId,
          paymentInfo: savedPayment,
        });
      } catch (error) {
        console.error("Payment Success Error:", error);
      }
      return res.send({ success: false });
    });
    // Payment get api
    app.get("/payment", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.customerEmail = email;
      }
      const cursor = paymentCollection.find(query).sort({ paidAt: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    console.log("Connected to MongoDB");
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Ticketbari-booking-platform is running!");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
