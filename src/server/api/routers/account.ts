import { TRPCError } from "@trpc/server";
import { createHash, randomBytes } from "crypto";
import validator from "validator";
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "~/server/api/trpc";

export const accountRouter = createTRPCRouter({
  createAccount: publicProcedure
    .input(
      z.object({
        name: z.string(),
        email: z.string(),
        password: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { name, email, password } = input;
      const salt = randomBytes(8).toString("hex");
      const hash = createHash("sha256")
        .update(`${salt}${password}`)
        .digest("hex");
      console.log(hash);
      if (
        name === "" ||
        !validator.isEmail(email) ||
        !validator.isStrongPassword(password)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Incorrect Details",
        });
      }
      const existingAccount = await ctx.prisma.user.findFirst({
        where: {
          email: email,
        },
      });
      if (existingAccount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Account with this email already exists",
        });
      }
      console.log("Creating account");
      const result = await ctx.prisma.user.create({
        data: {
          name: name,
          email: email,
          verificationCode: randomBytes(8).toString("hex"),
          password: hash,
          passwordSalt: salt,
          role: "Account",
        },
      });
      console.log(result);
    }),

  verifyAccount: publicProcedure
    .input(
      z.object({
        email: z.string(),
        verificationCode: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { email, verificationCode } = input;
      const user = await ctx.prisma.user.findFirst({
        where: {
          email: email,
        },
      });
      console.log(user);
      if (user === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User Not Found",
        });
      } else if (verificationCode !== user.verificationCode) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Incorrect Verification Code",
        });
      } else {
        ctx.prisma.user.update({
          where: {
            email: email,
          },
          data: {
            emailVerified: new Date(),
          },
        });
      }
    }),

  updatePassword: publicProcedure
    .input(
      z.object({
        email: z.string(),
        oldPass: z.string(),
        newPass: z.string(),
      })
    )
    .output(z.boolean())
    .mutation(async ({ input, ctx }) => {
      console.log(input.email);
      const user = await ctx.prisma.user.findFirst({
        where: {
          email: input.email,
        },
      });
      if (user === null) return false;

      const savedPass = createHash("sha256")
        .update(`${user.passwordSalt}${input.oldPass}`)
        .digest("hex");
      if (savedPass !== user.password) return false;
      const newPass = createHash("sha256")
        .update(`${user.passwordSalt}${input.newPass}`)
        .digest("hex");

      const res = await ctx.prisma.user.update({
        where: {
          email: input.email,
        },
        data: {
          password: newPass,
        },
      });
      return true;
    }),
});