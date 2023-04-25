const express = require("express")
const { v4: uuidv4 } = require("uuid")
const bodyParser = require("body-parser")
const cors = require("cors")
const fs = require("fs/promises")

require("dotenv").config()

const app = express()

app.use(cors())
app.use(express.static("public"))

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

let exercise_log = []
const getData = () => {
	fs
		.readFile("./exercise_log.json")
		.then(data => {
			exercise_log = JSON.parse(data)
		})
		.catch(err => {
			console.error(err)
		})
}
getData()
const writeData = async data => {
	try {
		await fs.writeFile("./exercise_log.json", JSON.stringify(data))
		console.log("Data written to file")
	} catch (err) {
		console.error(err)
	}
}

const isValidUser = id => {
	if (typeof id !== "string" || id.trim().length === 0) {
		return false
	}
	getData()
	return exercise_log.findIndex(user => user._id === id) !== -1
}

const incrementUserCount = userId => {
	getData()
	const user = exercise_log.find(user => user._id === userId)
	if (user) {
		user.count = user.log.length
	}
}

const fetchUserLogs = async (_id, from, to, limit) => {
	getData()
	const userLogs = exercise_log.find(user => user._id === _id)
	if (!userLogs) {
		throw new Error("User not found")
	}
	if (from && to) {
		userLogs.log = userLogs.log.filter(
			log =>
				log.date >= new Date(from).getTime() && log.date <= new Date(to).getTime()
		)
	} else if (from) {
		userLogs.log = userLogs.log.filter(
			log => log.date >= new Date(from).getTime()
		)
	} else if (to) {
		userLogs.log = userLogs.log.filter(log => log.date <= new Date(to).getTime())
	}

	// limit the number of logs returned, if "limit" parameter is provided
	if (limit) {
		userLogs.log = userLogs.log.slice(0, limit)
	}
	if (userLogs.log === undefined || userLogs.log.length === 0) {
		userLogs.log = []
		return userLogs
	} else {
		userLogs.log.forEach(log => {
      log.date = new Date(log.date).toDateString()
    })
		return userLogs
	}
}

app.get("/", (req, res) => {
	res.sendFile(__dirname + "/views/index.html")
})

//get all users
app.get("/api/users/", (req, res, next) => {
	getData()
	const users = exercise_log.map(obj => ({
		_id: obj._id,
		username: obj.username
	}))
	res.send(users)
})

// create user
app.post("/api/users", async (req, res, next) => {
	const username = req.body.username
	const user = {
		_id: uuidv4().replace(/[^a-zA-Z0-9]/g, ""),
		username,
		count: 0,
		log: []
	}
	exercise_log.push(user)
	await writeData(exercise_log)
	res.json({ _id: user._id, username: user.username })
})

//Add Exercise
app.post("/api/users/:_id/exercises", async (req, res, next) => {
	const _id = req.params._id
	const { description, duration} = req.body
  let date = req.body.date

  if(!date){
    date = new Date();
  }

	// Validate user ID
	if (!isValidUser(_id)) {
		return res.status(400).json({ error: "Invalid user ID" })
	}

	// Create new exercise log object
	const newExercise = {
		description: description,
		duration: parseInt(duration),
		date: new Date(date).getTime()
	}

	// Find user object in array and add new exercise log
	exercise_log.find(user => user._id === _id).log.push(newExercise)

	incrementUserCount(_id)

	writeData(exercise_log)

	// Send response with new exercise log object
	res.json({
		_id: _id,
		username: exercise_log.find(user => user._id === _id).username,
		date: new Date(newExercise.date).toDateString(),
		duration: newExercise.duration,
		description: newExercise.description
	})
})

//Get exercise log
app.get("/api/users/:_id/logs", (req, res, next) => {
	const _id = req.params._id
	const from = req.query.from
	const to = req.query.to
	const limit = req.query.limit

	// Validate user ID
	if (!isValidUser(_id)) {
		return res.status(400).json({ error: "Invalid user ID" })
	}

	// Use the "from", "to", and "limit" parameters to fetch the user's logs from the database
	fetchUserLogs(_id, from, to, limit)
		.then(logs => {
			res.send(logs)
		})
		.catch(error => {
			console.error(error)
			res.status(500).json({ error: "Failed to fetch user logs" })
		})
})

const listener = app.listen(process.env.PORT || 3000, () => {
	console.log("Your app is listening on port " + listener.address().port)
})
