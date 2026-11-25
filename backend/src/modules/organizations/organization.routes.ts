import { Router } from "express";
import { requireAuthentication, requireAuthContext } from "../../middleware/requireAuthentication.js";
import { HttpError } from "../../shared/HttpError.js";
import { setAccessCookie } from "../auth/auth.cookies.js";
import { organizationIdSchema, organizationSchema } from "../auth/auth.schemas.js";
import {
  createOrganization,
  isOrganizationUniqueViolation,
  listOrganizationsForUser,
  switchActiveOrganization,
} from "./organization.service.js";

export const organizationRouter = Router();

organizationRouter.use(requireAuthentication);

organizationRouter.get("/", async (request, response) => {
  const auth = requireAuthContext(request);
  response.status(200).json({
    organizations: await listOrganizationsForUser(auth.userId),
  });
});

organizationRouter.post("/", async (request, response) => {
  const auth = requireAuthContext(request);
  const parsed = organizationSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(400, "Organization details are invalid.");
  }

  try {
    const result = await createOrganization({
      userId: auth.userId,
      refreshTokenId: auth.refreshTokenId,
      ...parsed.data,
    });
    setAccessCookie(response, result.accessToken);
    response.status(201).json({ organization: result.organization });
  } catch (error) {
    if (isOrganizationUniqueViolation(error)) {
      throw new HttpError(409, "That organization slug is already reserved.");
    }
    throw error;
  }
});

organizationRouter.post("/:organizationId/switch", async (request, response) => {
  const auth = requireAuthContext(request);
  const parsedId = organizationIdSchema.safeParse(request.params.organizationId);
  if (!parsedId.success) {
    throw new HttpError(404, "Organization not found.");
  }

  const result = await switchActiveOrganization({
    userId: auth.userId,
    refreshTokenId: auth.refreshTokenId,
    organizationId: parsedId.data,
  });
  setAccessCookie(response, result.accessToken);
  response.status(200).json({ activeOrganization: result.organization });
});
