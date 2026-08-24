import express from "express";
import { postMediaUpload } from '../configs/multer.js'
import { attachDbUser, protect } from '../middlewares/auth.js'
import { addComment, addPost, deletePost, getComments, getFeedPost, getPost, getPostShareCard, getPublicPost, likePost, likePostIdempotent, unlikePost } from '../controllers/postController.js'

const postRouter = express.Router()

postRouter.post('/add', protect, attachDbUser, postMediaUpload.array('images', 4), addPost);
postRouter.get('/feed', protect, getFeedPost);
postRouter.post('/like', protect, likePost); // deprecated toggle
postRouter.put('/:postId/like', protect, likePostIdempotent);
postRouter.delete('/:postId/like', protect, unlikePost);
postRouter.post('/comment/add', protect, addComment);
postRouter.get('/:postId/comments', protect, getComments);
// Unauthenticated on purpose: a shared link has to open for someone who has no
// account yet. It answers only for posts that are public in every sense.
postRouter.get('/:postId/public', getPublicPost);
postRouter.get('/:postId/share-card', protect, getPostShareCard);
// Registered after every literal path so '/feed' is never read as an id.
postRouter.get('/:postId', protect, getPost);
postRouter.post('/delete', protect, deletePost);
postRouter.delete('/:postId', protect, deletePost);
postRouter.delete('/delete/:postId', protect, deletePost);

export default postRouter
