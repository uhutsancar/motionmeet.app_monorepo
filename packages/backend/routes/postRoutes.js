import express from 'express'
import { imageUpload } from '../configs/multer.js'
import { attachDbUser, protect } from '../middlewares/auth.js'
import { addComment, addPost, deletePost, getFeedPost, likePost } from '../controllers/postController.js'

const postRouter = express.Router()

postRouter.post('/add', protect, attachDbUser, imageUpload.array('images', 4), addPost);
postRouter.get('/feed', protect, getFeedPost);
postRouter.post('/like', protect, attachDbUser, likePost);
postRouter.post('/comment/add', protect, attachDbUser, addComment);
postRouter.post('/delete', protect, attachDbUser, deletePost);
postRouter.delete('/delete/:postId', protect, attachDbUser, deletePost);

export default postRouter
