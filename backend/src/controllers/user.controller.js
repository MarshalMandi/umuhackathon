import User from "../models/User.js"
import FriendRequest from "../models/FriendRequest.js"

export async function getRecommendedUsers(req, res) {
    try {
        const currentUserId = req.user._id
        const currentUser = req.user
        const recommendedUsers = await User.find({
            $and: [
                { _id: { $ne: currentUserId } },
                { _id: { $nin: currentUser.friends } },
                { isOnboarded: true }
            ]
        }).select("-password")
        res.status(200).json(recommendedUsers)
    } catch (error) {
        console.log("Error in getRecommendedUsers controller", error.message)
        res.status(500).json({ message: "Error in getRecommendedUsers controller" })
    }
}

export async function getMyFriends(req, res) {
    try {
        const currentUserId = req.user._id
        const myFriends = await User.findById(currentUserId).select("friends").populate(
            "friends", "fullName profilePic nativeSkills learningLanguage"
        )
        res.status(200).json(myFriends.friends)
    } catch (error) {
        console.log("Error in getMyFriends controller", error.message)
        res.status(500).json({ message: "Error in getMyFriends controller" })
    }
}

export async function sendFriendRequest(req, res) {
    try {
        const myId = req.user._id
        const { id: recipientId } = req.params
        if (myId === recipientId) {
            return res.status(400).json({ message: "You can't send friend request to yourself" })
        }
        const recipient = await User.findById(recipientId)
        if (!recipient) {
            return res.status(400).json({ message: "Recipient not found" })
        }
        if (recipient.friends.includes(myId)) {
            return res.status(400).json({ message: "You are already friends with this user" })
        }
        const existingRequest = await FriendRequest.findOne({
            $or: [
                { sender: myId, recipient: recipientId },
                { recipient: myId, sender: recipientId },
            ],
        })
        if (existingRequest) {
            return res.status(400).json({ message: "A friend request already exists between you and this user" })
        }
        const friendRequest = await FriendRequest.create({
            sender: myId,
            recipient: recipientId,
        })
        res.status(201).json(friendRequest)
    } catch (error) {
        console.log("Error in sendFriendRequest controller", error.message)
        res.status(500).json({ message: "Error in sendFriendRequest controller" })
    }
}

export async function acceptFriendRequest(req, res) {
    try {
        const { id: requestId } = req.params
        const friendRequest = await FriendRequest.findById(requestId)
        if (!friendRequest) {
            return res.status(404).json({ message: "Friend request not found" })
        }
        if (friendRequest.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "You are unauthorized to accept this request" })
        }
        friendRequest.status = "accepted"
        await friendRequest.save()
        await User.findByIdAndUpdate(friendRequest.sender, {
            $addToSet: { friends: friendRequest.recipient }
        })
        await User.findByIdAndUpdate(friendRequest.recipient, {
            $addToSet: { friends: friendRequest.sender }
        })
        res.status(200).json({ message: "Friend request Accepted" })
    } catch (error) {
        console.log("Error in acceptFriendRequest controller", error.message)
        res.status(500).json({ message: "Error in acceptFriendRequest controller" })
    }
}

export async function getFriendRequests(req, res) {
    try {
        const incomingRequests = await FriendRequest.find({
            recipient: req.user._id,
            status: "pending"
        }).populate("sender", "fullName profilePic nativeLanguage learningLanguage")
        const acceptedRequests = await FriendRequest.find({
            sender: req.user._id,
            status: "accepted"
        }).populate("recipient", "fullName profilePic")
        res.status(200).json({ incomingRequests, acceptedRequests })
    } catch (error) {
        console.log("Error in getFriendRequests controller", error.message)
        res.status(500).json({ message: "Error in getFriendRequests controller" })
    }
}

export async function getOutgoingFriendRequests(req, res) {
    try {
        const outgoingRequests = await FriendRequest.find({
            sender: req.user._id,
            status: "pending"
        }).populate("recipient", "fullName profilePic nativeLanguage learningLanguage")
        res.status(200).json(outgoingRequests)
    } catch (error) {
        console.log("Error in getOutgoingFriendRequests controller", error.message)
        res.status(500).json({ message: "Error in getOutgoingFriendRequests controller" })
    }
}