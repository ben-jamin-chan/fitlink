import {logger} from "firebase-functions/v2";

export interface ExpoPushPayload {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  sound: "default";
  badge?: number;
}

interface ExpoPushTicketDetails {
  error?: string;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: ExpoPushTicketDetails;
}

interface ExpoPushResponse {
  data: ExpoPushTicket[];
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export const sendExpoPushNotification = async (
  payload: ExpoPushPayload,
  logSource: string
): Promise<void> => {
  let response: Response;

  try {
    response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error: unknown) {
    logger.error(`${logSource}: Expo push request failed`, {
      error: getErrorMessage(error),
    });
    return;
  }

  if (!response.ok) {
    logger.error(`${logSource}: Expo push HTTP error`, {
      status: response.status,
      statusText: response.statusText,
    });
    return;
  }

  let responseValue: unknown;

  try {
    responseValue = await response.json();
  } catch (error: unknown) {
    logger.error(`${logSource}: Expo push response JSON parse failed`, {
      error: getErrorMessage(error),
    });
    return;
  }

  const result = toExpoPushResponse(responseValue);
  if (result === null) {
    logger.error(`${logSource}: Expo push response shape is invalid`);
    return;
  }

  for (const ticket of result.data) {
    if (ticket.status === "error") {
      logger.error(`${logSource}: Expo push ticket error`, {
        message: ticket.message,
        details: ticket.details,
      });

      if (ticket.details?.error === "DeviceNotRegistered") {
        logger.warn(`${logSource}: DeviceNotRegistered, token cleanup deferred`);
      }
    }
  }
};

export const isExpoPushToken = (value: string): boolean => {
  return value.startsWith("ExponentPushToken[") && value.endsWith("]");
};

function toExpoPushResponse(value: unknown): ExpoPushResponse | null {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    return null;
  }

  const tickets: ExpoPushTicket[] = [];

  for (const item of value.data) {
    const ticket = toExpoPushTicket(item);
    if (ticket === null) {
      return null;
    }

    tickets.push(ticket);
  }

  return {data: tickets};
}

function toExpoPushTicket(value: unknown): ExpoPushTicket | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.status !== "ok" && value.status !== "error") {
    return null;
  }

  const ticket: ExpoPushTicket = {
    status: value.status,
  };

  const id = getOptionalString(value.id);
  if (id !== undefined) {
    ticket.id = id;
  }

  const message = getOptionalString(value.message);
  if (message !== undefined) {
    ticket.message = message;
  }

  const details = toExpoPushTicketDetails(value.details);
  if (details !== undefined) {
    ticket.details = details;
  }

  return ticket;
}

function toExpoPushTicketDetails(
  value: unknown
): ExpoPushTicketDetails | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const error = getOptionalString(value.error);
  return error === undefined ? {} : {error};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
