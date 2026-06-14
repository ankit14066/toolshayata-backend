import mongoose from "mongoose";
import { generateError } from "../../config/Error/functions";
import Blog from "../../schemas/Blog/BlogSchema";
import { statusCode } from "../../config/helper/statusCode";
import { createCatchError } from "../../config/helper/function";
import { deleteFile, uploadFile } from "../uploadDoc.repository";

const createBlog = async (data: any) => {
  try {
    const createdBlog = new Blog({
      subTitle: data.subTitle,
      slug: data.slug,
      category: data.category,
      title: data.title,
      content: data.content,
      isPrivate: data.isPrivate,
      tags: data.tags,
      status: data.status,
      createdBy: data.createdBy,
      company: data.company
    });

    const savedBlog = await createdBlog.save();

    if (data.coverImage && data.coverImage !== "" && data?.coverImage?.buffer) {
      const uploaded = await uploadFile(data.coverImage);

      savedBlog.coverImage = {
        name: data.coverImage.filename,
        url: uploaded.url,             // ✅ string
        public_id: uploaded.public_id, // ✅ REQUIRED
        type: data.coverImage.type,
      };

      await savedBlog.save();
    }


    return {
      status: 'success',
      statusCode: statusCode.success,
      data: savedBlog,
      message: `${data.title} blog has been created successfully`
    }
  } catch (err: any) {
    return createCatchError(err)
  }
};


const updateBlog = async (data: any) => {
  try {

    const { coverImage, ...rest } = data;
    const updatedBlog: any = await Blog.findByIdAndUpdate(
      data.id,
      { $set: rest },
      { new: true }
    );

    if (data?.coverImage?.isDeleted === 1 && updatedBlog.coverImage?.name) {
      await deleteFile(updatedBlog.coverImage.public_id);
      updatedBlog.logo = {
        name: undefined,
        url: undefined,
        type: undefined,
      };
      await updatedBlog.save();
    }

    if (
      data.coverImage &&
      data.coverImage?.isAdd === 1 &&
      data.coverImage?.filename &&
      data.coverImage?.buffer
    ) {
      const { filename, type } = data.coverImage;
      const uploaded = await uploadFile(data.coverImage);

      updatedBlog.coverImage = {
        name: filename,
        url: uploaded.url,
        public_id: uploaded.public_id,
        type,
      };

      await updatedBlog.save();
    }


    return {
      status: 'success',
      statusCode: statusCode.success,
      data: updatedBlog,
      message: `${data.title} blog has been updated successfully`
    }
  } catch (err: any) {
    return createCatchError(err)
  }
};

const deleteBlog = async (data: any) => {
  try {
    const blogData = await Blog.findById(data.id);
    if (blogData) {
      if (data.deleted) {
        if (blogData.coverImage.name) {
          await deleteFile(blogData.coverImage.public_id);
        }
        await blogData.deleteOne();
        return {
          status: 'success',
          statusCode: statusCode.success,
          data: 'Blog has been deleted successfully',
          message: 'Blog has been deleted successfully',
        };
      } else {
        blogData.isActive = false;
        await blogData.save();
        return {
          status: 'success',
          statusCode: statusCode.success,
          data: 'Blog has been temporarily deleted successfully',
          message: 'Blog has been temporarily deleted successfully',
        };
      }
    } else {
      return {
        status: 'error',
        statusCode: statusCode.info,
        data: 'Blog does not exist',
        message: 'Blog does not exist',
      };
    }
  } catch (err: any) {
    return {
      status: 'error',
      statusCode: statusCode.serverError,
      data: err?.message,
      message: err?.message,
    };
  }
};


const blogStatusCounts = async ({ company }: any) => {
  try {
    const countsBlog = await Blog.aggregate([
      {
        $match: { company: { $in: company } },
      },
      {
        $facet: {
          privateBlogs: [
            { $match: { isPrivate: true, isActive: true } },
            { $count: "count" },
          ],
          publicBlogs: [
            { $match: { isPrivate: false, isActive: true } },
            { $count: "count" },
          ],
          deletedBlogs: [
            { $match: { isActive: false } },
            { $count: "count" },
          ],
        },
      },
      {
        $project: {
          privateBlogs: { $arrayElemAt: ["$privateBlogs.count", 0] },
          publicBlogs: { $arrayElemAt: ["$publicBlogs.count", 0] },
          deletedBlogs: { $arrayElemAt: ["$deletedBlogs.count", 0] },
        },
      },
    ]);

    return {
      status: "success",
      statusCode: statusCode.success,
      data: countsBlog[0],
      message: "Blog counts retrieved successfully",
    };
  } catch (err: any) {
    return createCatchError(err);
  }
};




const getBlogs = async (data: any) => {
  try {
    const blogs = await Blog.find({ isActive: true }) //// {company : {$in : data.company}}
      .populate({
        path: "createdBy",
        select: "name username _id pic slug category position createdAt",
      })
      .populate({
        path: "comments",
        select: "_id",
      })
      .select("title coverImage subTitle isPrivate createdAt tags createdBy slug category comments reactions")
      .sort({ createdAt: -1 })
      .skip((data.page - 1) * data.limit)
      .limit(data.limit);

    const totalCount = await Blog.countDocuments();
    const totalPages = Math.ceil(totalCount / data.limit);

    return {
      status: "success",
      message: 'Retrived blogs successfully',
      statusCode: statusCode.success,
      data: {
        totalPages: totalPages,
        data: blogs,
        currentPage: data.page,
      },
    };
  } catch (err) {
    return createCatchError(err)
  }
};

const getBlogById = async (data: any) => {
  try {
    let match: any = {};

    if (data.blogId) {
      match["_id"] = new mongoose.Types.ObjectId(data.blogId);
    }

    if (data.title) {
      match["slug"] = data.title;
    }

    const blog = await Blog.aggregate([
      {
        $match: match,
      },
      {
        $lookup: {
          from: "users",
          foreignField: "_id",
          localField: "createdBy",
          as: "createdBy",
        },
      },
      {
        $addFields: {
          createdBy: { $ifNull: [{ $arrayElemAt: ["$createdBy", 0] }, null] },
          reactions: { $size: "$reactions" },
        },
      },
      {
        $project: {
          title: 1,
          coverImage: 1,
          content: 1,
          tags: 1,
          status: 1,
          createdAt: 1,
          subTitle: 1,
          isPrivate: 1,
          slug: 1,
          category: 1,
          createdBy: {
            name: 1,
            username: 1,
            _id: 1,
            pic: 1,
            position: 1,
            createdAt: 1,
            bio: 1,
          },
          reactions: 1,
        },
      },
    ]);

    if (!blog || blog.length === 0) {
      throw generateError(`BLOG DOES NOT EXISTS`, 400);
    }
    return { status: "success", data: blog[0] };
  } catch (err) {
    return { status: "error", data: err };
  }
};

export { createBlog, updateBlog, deleteBlog, getBlogs, getBlogById, blogStatusCounts };
