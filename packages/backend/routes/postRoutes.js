import express from 'express'
import { postMediaUpload } from '../configs/multer.js'
import { attachDbUser, protect } from '../middlewares/auth.js'
import { addComment, addPost, deletePost, getComments, getFeedPost, likePost, likePostIdempotent, unlikePost } from '../controllers/postController.js'

const postRouter = express.Router()

postRouter.post('/add', protect, attachDbUser, postMediaUpload.array('images', 4), addPost);
postRouter.get('/feed', protect, getFeedPost);
postRouter.post('/like', protect, attachDbUser, likePost); // deprecated toggle
postRouter.put('/:postId/like', protect, attachDbUser, likePostIdempotent);
postRouter.delete('/:postId/like', protect, attachDbUser, unlikePost);
postRouter.post('/comment/add', protect, attachDbUser, addComment);
postRouter.get('/:postId/comments', protect, attachDbUser, getComments);
postRouter.post('/delete', protect, attachDbUser, deletePost);
postRouter.delete('/:postId', protect, attachDbUser, deletePost);
postRouter.delete('/delete/:postId', protect, attachDbUser, deletePost);

export default postRouter
