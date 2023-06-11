const express = require('express');
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.SECRET_KEY);
const app = express()

const port = process.env.PORT || 5000;

// middleware
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
    res.send("ModoNovo is Running.....................")
})

// Verify JWT
const VerifyJwt = (req, res, next) => {
    const authorization = req.headers.authorization
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'Unauthorized access' });
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'Unauthorized access' });
        }
        req.decoded = decoded;
        next()
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.a46jnic.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        client.connect();


        const usersCollections = client.db("modonovoDB").collection("users");
        const classesCollections = client.db("modonovoDB").collection("classes");
        const cartCollections = client.db("modonovoDB").collection("carts");
        const paymentsCollections = client.db("modonovoDB").collection("payments");

        // JWT
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        // VerifyAdmin
        const VerifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollections.findOne(query)
            if (user.role !== "Admin") {
                return res.status(401).send({ error: true, message: 'Unauthorized access' });
            }

            next()
        }
        // VerifyAdmin
        const VerifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollections.findOne(query)
            if (user.role !== "Instructor") {
                return res.status(401).send({ error: true, message: 'Unauthorized access' });
            }
            next()
        }


        // Users Api
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollections.findOne(query)
            if (existingUser) {
                return res.send({ message: "user already exist" })
            }
            const result = await usersCollections.insertOne(user);
            res.send(result)
        })

        // Get All Users
        app.get('/users', async (req, res) => {
            const result = await usersCollections.find().toArray()
            res.send(result)
        })
        // Get All Instructors
        app.get('/users/instructors', async (req, res) => {
            const filter = { role: "Instructor" }
            const result = await usersCollections.find(filter).toArray()
            res.send(result)
        })

        // Get Single User
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const result = await usersCollections.findOne(filter)
            res.send(result)
        })


        // Admin APIs

        // Make User into Admin
        app.patch('/users/admin/:id', VerifyJwt, VerifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: "Admin"
                }
            }
            const result = await usersCollections.updateOne(query, updatedDoc)
            res.send(result)
        })
        // Convert User into instructors 
        app.patch('/users/instructors/:id', VerifyJwt, VerifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: "Instructor"
                }
            }
            const result = await usersCollections.updateOne(query, updatedDoc)
            res.send(result)
        })

        // Get admin
        app.get('/users/admin/:email', VerifyJwt, async (req, res) => {
            const email = req?.params?.email
            // console.log(email);

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email }
            const user = await usersCollections.findOne(query);
            const result = { admin: user?.role === 'Admin' }
            res.send({ result: result });
        })
        // Get Instructor
        app.get('/users/instructors/:email', VerifyJwt, async (req, res) => {
            const email = req?.params?.email


            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }

            const query = { email: email }
            const user = await usersCollections.findOne(query);
            const result = { instructor: user?.role === 'Instructor' }

            res.send({ result: result });
        })

        // Classes Api

        app.post('/classes', VerifyJwt, VerifyInstructor, async (req, res) => {
            const course = req.body;
            const result = await classesCollections.insertOne(course)
            res.send(result)
        })

        // Get classes
        app.get('/classes', async (req, res) => {
            const result = await classesCollections.find().toArray()
            res.send(result)
        })

        app.get('/classes/:email', VerifyJwt, async (req, res) => {
            const email = req.params.email;
            const filter = { instructorEmail: email }
            const result = await classesCollections.find(filter).toArray()
            res.send(result)

        })
        // Get a single class
        app.get('/instructors/classes/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await classesCollections.findOne(filter)
            res.send(result)

        })
        // Update a single class
        app.patch('/instructors/classes/:id', VerifyJwt, VerifyInstructor, async (req, res) => {
            const id = req.params.id;
            const updatedClass = req.body
            console.log(updatedClass);
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    className: updatedClass.className,
                    price: updatedClass.price,
                    availableSeats: updatedClass.availableSeats,
                    details: updatedClass.details
                },
            };
            const result = await classesCollections.updateOne(filter, updateDoc)
            res.send(result)
        })

        // Delete a single class
        app.delete('/instructors/classes/:id', VerifyJwt, VerifyInstructor, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await classesCollections.deleteOne(filter)
            res.send(result)
        })



        // change class status to approved
        app.patch('/classes/status/approved/:id', VerifyJwt, VerifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: "Approved"
                }
            }
            const result = await classesCollections.updateOne(query, updatedDoc)
            res.send(result)
        })
        // change class status to Denny
        app.patch('/classes/status/denied/:id', VerifyJwt, VerifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: "Denied"
                }
            }
            const result = await classesCollections.updateOne(query, updatedDoc)
            res.send(result)
        })

        // Saved Class 
        app.post('/carts', VerifyJwt, async (req, res) => {
            const cartItem = req.body;
            const result = await cartCollections.insertOne(cartItem)
            res.send(result)
        })
        //get cart items
        app.get('/carts/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const result = await cartCollections.find(filter).toArray()
            res.send(result)
        })

        //remove a class from cart
        app.delete('/carts/saved/:id', VerifyJwt, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await cartCollections.deleteOne(filter)
            res.send(result)
        })
        //get a class from cart
        app.get('/carts/saved/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await cartCollections.findOne(filter)
            res.send(result)
        })

        // Payment Related API
        app.post('/create-payment-intent', VerifyJwt, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        app.post('/payments', VerifyJwt, async (req, res) => {
            const payment = req.body
            const insetResult = await paymentsCollections.insertOne(payment)
            const orderId = payment.orderId
            const orderQuery = { _id: new ObjectId(orderId) }
            const deleteResult = await cartCollections.deleteOne(orderQuery)

            const courseId = payment.courseId
            const course = await classesCollections.findOne({ _id: new ObjectId(courseId) })
            console.log(course);

            const updateDoc = {
                $set: {
                    availableSeats: course.availableSeats - 1,
                    enrolledStudent: course.enrolledStudent + 1
                },
            };

            const editedResult = await classesCollections.updateOne({ _id: new ObjectId(courseId) }, updateDoc)


            res.send({ insetResult, deleteResult, editedResult })
        })




        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`modonovo is runnning at port :${port}`);
})