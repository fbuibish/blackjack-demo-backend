// src/controllers/userController.ts
import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const createUser = async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.create({
      data: req.body,
    });
    res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getUsers = async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany();
    res.status(200).json({ success: true, data: users });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};
