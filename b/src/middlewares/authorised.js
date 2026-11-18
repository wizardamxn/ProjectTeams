import { getUserFromToken } from "../utils/auth.js";

const authorized = async (req, res, next) => {
  try {
    const user = await getUserFromToken(req.cookies?.token);
    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export default authorized;
