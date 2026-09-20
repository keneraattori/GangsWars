declare global {
  namespace Express {
    interface Request {
      userId?: string;
      username?: string;
    }
  }
}

export {};
