export interface User {
  id: string;
  username: string;
  email: string | null;
  passwordHash: string;
  createdAt: Date;
}

export interface PublicUser {
  id: string;
  username: string;
}
