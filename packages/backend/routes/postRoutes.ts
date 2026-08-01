import express from "express";
import { postMediaUpload } from '../configs/multer.js'
import { attachDbUser, protect } from '../middlewares/auth.js'
import { addComment, addPost, deletePost, getComments, getFeedPost, likePost, likePostIdempotent, unlikePost } from '../controllers/postController.js'

const postRouter = express.Router()

postRouter.post('/add', protect, attachDbUser, postMediaUpload.array('images', 4), addPost);
postRouter.get('/feed', protect, getFeedPost);
postRouter.post('/like', protect, likePost); // deprecated toggle
postRouter.put('/:postId/like', protect, likePostIdempotent);
postRouter.delete('/:postId/like', protect, unlikePost);
postRouter.post('/comment/add', protect, addComment);
postRouter.get('/:postId/comments', protect, getComments);
postRouter.post('/delete', protect, deletePost);
postRouter.delete('/:postId', protect, deletePost);
postRouter.delete('/delete/:postId', protect, deletePost);

export default postRouter
