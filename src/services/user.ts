import { prisma } from "../db/client";
import { hashPassword } from "../utils/auth";
import type { User } from "@prisma/client";

export interface CreateUserInput {
    email: string;
    password: string;
    name: string;
    avatarUrl?: string;
}

export const getUsers = async (query: Partial<User>): Promise<User[]> => {
    try {
        const users = await prisma.user.findMany({
            where: {
                ...query,
            }
        });
        return users;
    } catch (error) {
        console.error("Error getting users:", error);
        throw new Error("Failed to get users");
    }
}

export const createUser = async (data: CreateUserInput): Promise<User> => {
    try {
        const hashedPassword = await hashPassword(data.password);
        const user = await prisma.user.create({
            data: {
                email: data.email,
                passwordHash: hashedPassword,
                name: data.name,
                avatarUrl: data.avatarUrl,
            },
        });
        return user;
    } catch (error) {
        console.error("Error creating user:", error);
        throw new Error("Failed to create user");
    }
}


const userService = {
    createUser,
    getUsers,
}

export default userService;