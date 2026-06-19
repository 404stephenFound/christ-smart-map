import jwt from 'jsonwebtoken';

export const requireAuth = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.teacherId = decoded.id;
    req.teacherEmail = decoded.email;
    next();
  } catch (error) {
    console.error('JWT Verification error:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
