import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { avatarUpload } from '../middleware/upload.js';
import * as auth from '../controllers/authController.js';
import * as boards from '../controllers/boardController.js';
import * as lists from '../controllers/listController.js';
import * as tasks from '../controllers/taskController.js';
import * as notifications from '../controllers/notificationController.js';
import * as comments from '../controllers/commentController.js';
import * as invites from '../controllers/inviteController.js';
import * as ownershipTransfers from '../controllers/ownershipTransferController.js';
import * as users from '../controllers/userController.js';
import * as boardChat from '../controllers/boardChatController.js';
import * as dm from '../controllers/dmController.js';
import { body } from 'express-validator';

const router = Router();

router.get('/health', (req, res) => res.json({ ok: true }));

router.post('/auth/register', auth.registerValidators, auth.register);
router.post('/auth/login', auth.loginValidators, auth.login);
router.get('/auth/me', authenticate, auth.me);
router.put('/auth/profile', authenticate, auth.updateProfileValidators, auth.updateProfile);
router.post(
  '/auth/avatar',
  authenticate,
  avatarUpload.single('avatar'),
  auth.uploadAvatar
);
router.delete('/auth/avatar', authenticate, auth.deleteAvatar);

router.get('/boards', authenticate, boards.listBoards);
router.post('/boards', authenticate, boards.createBoardValidators, boards.createBoard);
router.get('/boards/:id', authenticate, boards.boardIdParam, boards.getBoard);
router.put(
  '/boards/:id',
  authenticate,
  boards.boardIdParam,
  body('title').trim().isLength({ min: 1, max: 255 }),
  boards.updateBoard
);
router.post('/boards/:id/freeze', authenticate, boards.boardIdParam, boards.freezeBoard);
router.post('/boards/:id/unfreeze', authenticate, boards.boardIdParam, boards.unfreezeBoard);
router.delete('/boards/:id', authenticate, boards.boardIdParam, boards.deleteBoard);
router.get('/boards/:boardId/activity', authenticate, boards.listActivity);
router.get(
  '/boards/:boardId/messages',
  authenticate,
  boardChat.boardChatBoardId,
  boardChat.listMessages
);
router.post(
  '/boards/:boardId/messages',
  authenticate,
  boardChat.sendMessageValidators,
  boardChat.sendMessage
);
router.get('/boards/:boardId/members', authenticate, boards.listMembers);
router.post('/boards/:boardId/members', authenticate, boards.inviteMemberValidators, boards.inviteMember);
router.put(
  '/boards/:boardId/members/:userId/role',
  authenticate,
  boards.updateMemberRoleValidators,
  boards.updateMemberRole
);
router.post(
  '/boards/:boardId/ownership-transfer',
  authenticate,
  ownershipTransfers.requestTransferValidators,
  ownershipTransfers.requestOwnershipTransfer
);
router.delete(
  '/boards/:boardId/ownership-transfer',
  authenticate,
  ownershipTransfers.cancelOwnershipTransfer
);
router.delete('/boards/:boardId/members/:userId', authenticate, boards.removeMember);
router.delete('/boards/:boardId/invites/:inviteId', authenticate, boards.cancelPendingInvite);

router.get('/lists/:boardId', authenticate, lists.listsByBoard);
router.post('/lists', authenticate, lists.createListValidators, lists.createList);
router.put('/lists/:id', authenticate, lists.updateListValidators, lists.updateList);
router.delete('/lists/:id', authenticate, lists.deleteList);
router.post(
  '/lists/:listId/reorder',
  authenticate,
  lists.reorderTasksValidators,
  lists.reorderTasksInList
);

router.get('/comments/:taskId', authenticate, comments.listComments);
router.post('/comments/:taskId', authenticate, comments.addCommentValidators, comments.addComment);

router.get('/tasks/:listId', authenticate, tasks.tasksByList);

router.post('/tasks', authenticate, tasks.createTaskValidators, tasks.createTask);
router.put('/tasks/:id', authenticate, tasks.updateTaskValidators, tasks.updateTask);
router.delete('/tasks/:id', authenticate, tasks.deleteTask);

router.get('/invites/pending', authenticate, invites.listPendingInvites);
router.post('/invites/:id/accept', authenticate, invites.inviteIdParam, invites.acceptInvite);
router.post('/invites/:id/decline', authenticate, invites.inviteIdParam, invites.declineInvite);

router.get(
  '/ownership-transfers/pending',
  authenticate,
  ownershipTransfers.listPendingOwnershipTransfers
);
router.post(
  '/ownership-transfers/:id/accept',
  authenticate,
  ownershipTransfers.transferIdParam,
  ownershipTransfers.acceptOwnershipTransfer
);
router.post(
  '/ownership-transfers/:id/decline',
  authenticate,
  ownershipTransfers.transferIdParam,
  ownershipTransfers.declineOwnershipTransfer
);

router.get('/users/search', authenticate, users.searchUsersValidators, users.searchUsers);
router.get('/users/:id/profile', authenticate, users.userIdParam, users.getUserProfile);

router.get('/dm/conversations', authenticate, dm.listConversations);
router.post('/dm/conversations', authenticate, dm.openConversationValidators, dm.openConversation);
router.get(
  '/dm/conversations/:conversationId/messages',
  authenticate,
  dm.conversationIdParam,
  dm.listMessages
);
router.post(
  '/dm/conversations/:conversationId/messages',
  authenticate,
  dm.sendDmValidators,
  dm.sendMessage
);

router.get('/notifications', authenticate, notifications.listNotifications);
router.put(
  '/notifications/:id/read',
  authenticate,
  notifications.readNotificationValidators,
  notifications.markNotificationRead
);

export default router;
