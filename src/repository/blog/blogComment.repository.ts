import CommentBlog from "../../schemas/Blog/BlogCommentSchema";

const createBlogComment = async (data: any) => {
  try {
    const instance = new CommentBlog({
      user: data.user,
      company: data.company,
      blog: data.blog,
      content: data.content,
      parentComment: data.parentComment,
    });
    const savedBlog = await instance.save();
    return { status: "success", data: savedBlog };
  } catch (err) {
    return { status: "error", data: err };
  }
};

const getBlogComments = async (data : any) => {
  try {
    const pageSize = 5;
    const skip = (data.page - 1) * pageSize;
    const totalComments = await CommentBlog.countDocuments({ blog: data.blogId });
    const totalPages = Math.ceil(totalComments / pageSize);
    const comments = await CommentBlog.find({ blog: data.blogId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate({
        path: "user",
        select: "name username pic",
      })
      .populate({
        path: "replies",
        populate: {
          path: "user",
          select: "name username",
        },
      });
    return {status : 'success', data : {comments, totalPages, totalComments}}
  } catch (err) {
    return {status : 'error', data : err}
  }
};

export { createBlogComment, getBlogComments };
