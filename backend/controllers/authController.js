const pool = require("../config/dbConnect");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const login = async (req, res, next) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: "Username and password are required." });

        const [users] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
        if (users.length === 0) return res.status(401).json({ message: "Unauthorized." });

        const foundUser = users[0];
        const match = await bcrypt.compare(password, foundUser.password_hash);
        console.log(match);
        console.log(password)
        if (match) {
            const role = foundUser.role;
            const accessToken = jwt.sign(
                {
                    userInfo: {
                        userId: foundUser.id,
                        role: role
                    }
                },
                process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: '1d' }
            );
            res.json({ accessToken, role, userId: foundUser.id });
        } else {
            res.status(401).json({ message: "Unauthorized." });
        }
    } catch (err) { 
        next(err); 
    }
}

module.exports = { login };
