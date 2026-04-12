import { Prisma } from '@prisma/client';

export function isDatabaseUnavailableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return false;
  }

  if (error instanceof Error) {
    return error.message.includes("Can't reach database server") || error.message.includes('Error in PostgreSQL connection');
  }

  return false;
}

export function toSafeApiError(error: Error) {
  if (isDatabaseUnavailableError(error)) {
    return {
      statusCode: 503,
      message: 'Database connection is unavailable.',
    };
  }

  return {
    statusCode: 500,
    message: 'Internal server error.',
  };
}
