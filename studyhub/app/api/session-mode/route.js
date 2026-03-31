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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
var server_1 = require("next/server");
var next_auth_1 = require("next-auth");
var auth_1 = require("@/lib/auth");
var db_1 = require("@/lib/db");
// GET: ambil mode sesi untuk slot+tanggal
// Query: ?slotId=xxx&slotType=personal&date=2026-03-31
// Default: LANGSUNG (jika tidak ada record = default offline)
function GET(req) {
    return __awaiter(this, void 0, void 0, function () {
        var session, searchParams, slotId, slotType, dateParam, date, record;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, next_auth_1.getServerSession)(auth_1.authOptions)];
                case 1:
                    session = _c.sent();
                    if (!((_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.id))
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 })];
                    searchParams = new URL(req.url).searchParams;
                    slotId = searchParams.get('slotId');
                    slotType = searchParams.get('slotType') // "personal" | "class"
                    ;
                    dateParam = searchParams.get('date');
                    if (!slotId || !slotType || !dateParam) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'slotId, slotType, date diperlukan' }, { status: 400 })];
                    }
                    date = new Date(dateParam);
                    date.setUTCHours(0, 0, 0, 0);
                    return [4 /*yield*/, db_1.db.classSessionMode.findUnique({
                            where: { slotId_slotType_date: { slotId: slotId, slotType: slotType, date: date } },
                        })
                        // Default LANGSUNG jika tidak ada record (record hanya dibuat saat MAYA)
                    ];
                case 2:
                    record = _c.sent();
                    // Default LANGSUNG jika tidak ada record (record hanya dibuat saat MAYA)
                    return [2 /*return*/, server_1.NextResponse.json({ mode: (_b = record === null || record === void 0 ? void 0 : record.mode) !== null && _b !== void 0 ? _b : 'LANGSUNG', record: record })];
            }
        });
    });
}
// POST: set mode sesi per tanggal
// Body: { slotId, slotType, date, mode: "MAYA" | "LANGSUNG", note?, groupId? }
function POST(req) {
    return __awaiter(this, void 0, void 0, function () {
        var session, body, slotId, slotType, date, mode, note, groupId, admin, normalizedDate, group_1, slot_1, members, record, group_2, slot_2, members;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (0, next_auth_1.getServerSession)(auth_1.authOptions)];
                case 1:
                    session = _b.sent();
                    if (!((_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.id))
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 })];
                    return [4 /*yield*/, req.json()];
                case 2:
                    body = _b.sent();
                    slotId = body.slotId, slotType = body.slotType, date = body.date, mode = body.mode, note = body.note, groupId = body.groupId;
                    if (!slotId || !slotType || !date || !['MAYA', 'LANGSUNG'].includes(mode)) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'slotId, slotType, date, mode wajib diisi' }, { status: 400 })];
                    }
                    if (!(slotType === 'class' && groupId)) return [3 /*break*/, 4];
                    return [4 /*yield*/, db_1.db.groupMember.findFirst({
                            where: { userId: session.user.id, groupId: groupId, role: 'ADMIN' },
                        })];
                case 3:
                    admin = _b.sent();
                    if (!admin)
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'Hanya komisaris yang dapat mengatur mode kelas' }, { status: 403 })];
                    _b.label = 4;
                case 4:
                    normalizedDate = new Date(date);
                    normalizedDate.setUTCHours(0, 0, 0, 0);
                    if (!(mode === 'LANGSUNG')) return [3 /*break*/, 11];
                    // Hapus record (kembali ke default LANGSUNG)
                    return [4 /*yield*/, db_1.db.classSessionMode.deleteMany({
                            where: { slotId: slotId, slotType: slotType, date: normalizedDate },
                        })
                        // Jika class + admin, hapus dan notifikasi anggota bahwa kembali ke luring
                    ];
                case 5:
                    // Hapus record (kembali ke default LANGSUNG)
                    _b.sent();
                    if (!(slotType === 'class' && groupId)) return [3 /*break*/, 10];
                    return [4 /*yield*/, db_1.db.group.findUnique({ where: { id: groupId }, select: { name: true } })];
                case 6:
                    group_1 = _b.sent();
                    return [4 /*yield*/, db_1.db.classScheduleSlot.findUnique({ where: { id: slotId }, select: { title: true } })];
                case 7:
                    slot_1 = _b.sent();
                    return [4 /*yield*/, db_1.db.groupMember.findMany({
                            where: { groupId: groupId, NOT: { userId: session.user.id } },
                        })];
                case 8:
                    members = _b.sent();
                    if (!(members.length > 0)) return [3 /*break*/, 10];
                    return [4 /*yield*/, db_1.db.notification.createMany({
                            data: members.map(function (m) {
                                var _a;
                                return ({
                                    userId: m.userId,
                                    type: 'CLASS_MODE_CHANGED',
                                    title: "Mode kuliah diperbarui \u2014 ".concat(group_1 === null || group_1 === void 0 ? void 0 : group_1.name),
                                    message: "".concat((_a = slot_1 === null || slot_1 === void 0 ? void 0 : slot_1.title) !== null && _a !== void 0 ? _a : 'Kuliah', " pada ").concat(new Date(normalizedDate).toLocaleDateString('id-ID'), " kembali ke Sinkron Langsung (Luring)."),
                                    link: "/kelas/".concat(groupId),
                                });
                            }),
                        })];
                case 9:
                    _b.sent();
                    _b.label = 10;
                case 10: return [2 /*return*/, server_1.NextResponse.json({ mode: 'LANGSUNG' })];
                case 11: return [4 /*yield*/, db_1.db.classSessionMode.upsert({
                        where: { slotId_slotType_date: { slotId: slotId, slotType: slotType, date: normalizedDate } },
                        update: { mode: mode, note: (note === null || note === void 0 ? void 0 : note.trim()) || null, setById: session.user.id, groupId: groupId || null },
                        create: {
                            slotId: slotId,
                            slotType: slotType,
                            date: normalizedDate,
                            mode: mode,
                            note: (note === null || note === void 0 ? void 0 : note.trim()) || null,
                            setById: session.user.id,
                            groupId: groupId || null,
                        },
                    })
                    // Notifikasi anggota jika class mode
                ];
                case 12:
                    record = _b.sent();
                    if (!(slotType === 'class' && groupId)) return [3 /*break*/, 17];
                    return [4 /*yield*/, db_1.db.group.findUnique({ where: { id: groupId }, select: { name: true } })];
                case 13:
                    group_2 = _b.sent();
                    return [4 /*yield*/, db_1.db.classScheduleSlot.findUnique({ where: { id: slotId }, select: { title: true } })];
                case 14:
                    slot_2 = _b.sent();
                    return [4 /*yield*/, db_1.db.groupMember.findMany({
                            where: { groupId: groupId, NOT: { userId: session.user.id } },
                        })];
                case 15:
                    members = _b.sent();
                    if (!(members.length > 0)) return [3 /*break*/, 17];
                    return [4 /*yield*/, db_1.db.notification.createMany({
                            data: members.map(function (m) {
                                var _a;
                                return ({
                                    userId: m.userId,
                                    type: 'CLASS_MODE_CHANGED',
                                    title: "Mode kuliah berubah \u2014 ".concat(group_2 === null || group_2 === void 0 ? void 0 : group_2.name),
                                    message: "".concat((_a = slot_2 === null || slot_2 === void 0 ? void 0 : slot_2.title) !== null && _a !== void 0 ? _a : 'Kuliah', " pada ").concat(new Date(normalizedDate).toLocaleDateString('id-ID'), " diganti ke Sinkron Maya (Daring).").concat(note ? " Catatan: ".concat(note) : ''),
                                    link: "/kelas/".concat(groupId),
                                });
                            }),
                        })];
                case 16:
                    _b.sent();
                    _b.label = 17;
                case 17: return [2 /*return*/, server_1.NextResponse.json({ mode: record.mode, record: record })];
            }
        });
    });
}
