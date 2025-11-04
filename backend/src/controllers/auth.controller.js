import jwt from "jsonwebtoken"

import User from "../models/User.js"
import { upsertStreamUser } from "../lib/stream.js"

export let signup = async (req, res) => {
    const { email, password, fullName } = req.body
    try {
        if (!email || !password || !fullName) {
            return res.status(400).json({ message: "All fields are required" })
        }
        if (password.length < 6) {
            return res.status(400).json({ message: "Password must at least be 6 characters" })
        }
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Invalid email format" })
        }
        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return res.status(400).json({ message: "Email already exists, please use a different one" })
        }
        const idx = Math.floor(Math.random() * 100) + 1
        const randomAvatar = `https://avatar.iran.liara.run/public/${idx}.png`
        const newUser = await User.create({
            email,
            fullName,
            password,
            profilePic: randomAvatar,
        })
        try {
            await upsertStreamUser({
                id: newUser._id.toString(),
                name: newUser.fullName,
                image: newUser.profilePic || "",
            })
            console.log(`Stream User Created For ${newUser.fullName}`)
        } catch (error) {
            console.log("Error Creating Stream User", error)
        }
        const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET_KEY, {
            expiresIn: "7d",
        })
        res.cookie("jwt", token, {
            maxAge: 7 * 24 * 60 * 60 * 1000,
            httpOnly: true, //prevents XSS attacks
            sameSite: "strict", //prevents CSRF attacks
            secure: process.env.NODE_ENV === "production",
        })
        res.status(201).json({ success: true, user: newUser })
    } catch (error) {
        console.log("Error in Signup controller", error)
        res.status(500).json({ message: "Error in Signup controller" })
    }
}

export let login = async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email || !password) {
            return res.status(400).json({ message: "All fields are required" })
        }
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(404).json({ message: "Invalid Credentials" })
        }
        const isPasswordCorrect = await user.matchPassword(password)
        if (!isPasswordCorrect) {
            return res.status(401).json({ message: "Invalid Credentials" })
        }
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY, {
            expiresIn: "7d",
        })
        res.cookie("jwt", token, {
            maxAge: 7 * 24 * 60 * 60 * 1000,
            httpOnly: true, //prevents XSS attacks
            sameSite: "strict", //prevents CSRF attacks
            secure: process.env.NODE_ENV === "production",
        })
        res.status(200).json({ success: true, user })
    } catch (error) {
        console.log("Error in Login controller", error)
        res.status(500).json({ message: "Error in Login controller" })
    }
}

export let logout = async (req, res) => {
    res.clearCookie("jwt")
    res.status(200).json({ success: true, message: "Logged Out Successfully" })
}

export let onboard = async (req, res) => {
    try {
        const userId = req.user._id
        const { fullName, bio, nativeSkills, learningLanguage, location } = req.body
        if (!fullName || !bio || !nativeSkills || !learningLanguage || !location) {
            return res.status(400).json({
                message: "All Fields Are Required",
                missingFields: [
                    !fullName && "fullName",
                    !bio && "bio",
                    !nativeSkills && "nativeSkills",
                    !learningLanguage && "learningLanguage",
                    !location && "location",
                ].filter(Boolean),
            })
        }
        const skillsList = nativeSkills.split(",").map(skill => skill.trim());
        const updatedUser = await User.findByIdAndUpdate(userId, {
            fullName,
            bio,
            nativeSkills: skillsList,
            learningLanguage,
            location,
            isOnboarded: true,
        }, { new: true })
        if (!updatedUser) {
            return res.status(404).json({ message: "Error In Updating User" })
        }
        try {
            await upsertStreamUser({
                id: updatedUser._id,
                name: updatedUser.fullName,
                image: updatedUser.profilePic || "",
            })
            console.log(`Stream User Updated After Onboarding for ${updatedUser.fullName}`)
        } catch (error) {
            console.log("Error updating Stream User during Onboarding:", error.message)
        }
        res.status(200).json({ success: true, message: updatedUser })
    } catch (error) {
        console.log("Onboarding Error")
        res.status(500).json({ message: "Onboarding Error" })
    }
}

export let addskill = async (req, res) => {
    try {
        const { newSkill } = req.body
        const userId = req.user._id
        const newSkills = await User.findByIdAndUpdate(userId, { $addToSet: { nativeSkills: newSkill } }, { new: true })
        res.status(200).json({ newSkills })
    } catch (error) {
        console.log("adding skill error")
        res.status(500).json({ message: "Adding Skill error" })
    }
}