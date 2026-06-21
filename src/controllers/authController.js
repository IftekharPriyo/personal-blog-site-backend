const bcrypt = require("bcryptjs");
const { z } = require("zod");

const { prisma } = require("../config/db");
const { generateToken, clearTokenCookie } = require("../utils/generateToken");

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
});

const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
});

function validationError(res, error) {
  return res.status(400).json({
    message: "Invalid request data",
    errors: error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  });
}

async function register(req, res, next) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const user = await prisma.$transaction(
      async (tx) => {
        const adminExists = await tx.user.count({ where: { role: "ADMIN" } });

        if (adminExists) {
          const error = new Error("Admin registration is disabled");
          error.statusCode = 403;
          throw error;
        }

        return tx.user.create({
          data: {
            name: parsed.data.name,
            email: parsed.data.email,
            password: passwordHash,
            role: "ADMIN",
          },
          select: { id: true, name: true, email: true, role: true },
        });
      },
      { isolationLevel: "Serializable" },
    );

    generateToken(user.id, res);
    return res.status(201).json({ message: "Admin registered successfully", user });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    if (error.code === "P2002") {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    if (error.code === "P2034") {
      return res.status(409).json({ message: "Admin registration is already in progress" });
    }

    return next(error);
  }
}

async function login(req, res, next) {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    const passwordMatches = user
      ? await bcrypt.compare(parsed.data.password, user.password)
      : false;

    if (!user || !passwordMatches || user.role !== "ADMIN") {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    generateToken(user.id, res);

    return res.json({
      message: "Logged in successfully",
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    return next(error);
  }
}

function logout(req, res) {
  clearTokenCookie(res);
  return res.json({ message: "Logged out successfully" });
}

module.exports = { register, login, logout };
