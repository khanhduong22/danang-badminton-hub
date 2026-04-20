"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const crawlerJob_1 = require("./cron/crawlerJob");
dotenv_1.default.config();
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Basic endpoints
app.get('/api/courts', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const courts = yield prisma.court.findMany();
        res.json(courts);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch courts' });
    }
}));
app.get('/api/wandering-posts', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const posts = yield prisma.wanderingPost.findMany({
            orderBy: { created_at: 'desc' },
            include: {
                court: true
            }
        });
        res.json(posts);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch wandering posts' });
    }
}));
app.listen(PORT, () => {
    console.log(`🚀 Backend is running on http://localhost:${PORT}`);
    // Khởi động cron job cào dữ liệu
    (0, crawlerJob_1.startCrawlerCron)();
});
