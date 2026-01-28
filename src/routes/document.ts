import { Router } from "express";
import documentController from "../controllers/document";
import { veriyfyToken } from "../middleware/auth";
import { Request } from "express";

export const documentRouter = Router();

documentRouter.post("/", veriyfyToken, async (req, res) => {
    await documentController.createDocument(req as Request & { userId: string }, res);
});
documentRouter.get("/", veriyfyToken, async (req, res) => {
    await documentController.getDocuments(req as Request & { userId: string }, res);
});
documentRouter.get("/user", veriyfyToken, async (req, res) => {
    await documentController.getUserDocuments(req as Request & { userId: string }, res);
});
documentRouter.get("/:id", veriyfyToken, async (req, res) => {
    await documentController.getDocumentById(req as Request & { userId: string }, res);
});

export default documentRouter;