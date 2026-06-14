import {
  blogStatusCounts,
  createBlog,
  deleteBlog,
  getBlogById,
  getBlogs,
  updateBlog,
} from "../../repository/blog/blog.repository";
import { generateError } from "../../config/Error/functions";
import {
  createBlogValidation,
  getBlogByIdValidation,
} from "./utils/validation";
import { NextFunction, Response } from "express";
import { convertIdsToObjects } from "../../config/helper/function";
import mongoose from "mongoose";

const createBlogService = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { error, value } = createBlogValidation.validate(req.body);
    if (error) {
      throw generateError(error.details, 422);
    }

    const { status, statusCode, data, message } = await createBlog({
      ...value,
      createdBy: req.userId,
      company: req.body.company,
    });
    res.status(statusCode).send({
      data: data,
      success: status,
      message: message,
    });
  } catch (err: any) {
    next(err);
  }
};

const updateBlogService = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, statusCode, data, message } = await updateBlog({
      ...req.body,
      createdBy: req.userId,
      company: req.body.company,
    });
    res.status(statusCode).send({
      data: data,
      success: status,
      message: message,
    });
  } catch (err: any) {
    next(err);
  }
};

const deleteBlogService = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, statusCode, data, message } = await deleteBlog({id : new mongoose.Types.ObjectId(req.params.id), deleted : req.body.deleted});
    res.status(statusCode).send({
      data: data,
      success: status,
      message: message,
    });
  } catch (err: any) {
    next(err);
  }
};

const getBlogCountService = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const company = await convertIdsToObjects(req.body.company);
    const { status, statusCode, data, message } = await blogStatusCounts({
      company
    });
    res.status(statusCode).send({
      data: data,
      success: status,
      message: message,
    });
  } catch (err: any) {
    next(err);
  }
};



const getBlogsService = async (req: any, res: Response, next: NextFunction) => {
  try {
    let page = req.query.page || 1;
    let limit = req.query.limit || 10;
    const company = await convertIdsToObjects(req.body.company);
    const { status, data, message, statusCode } = await getBlogs({
      page,
      limit,
      company,
    });
    res.status(statusCode).send({
      success: status,
      message: message,
      data: data,
    });
  } catch (err) {
    next(err);
  }
};

const getBlogByIdService = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { error } = getBlogByIdValidation.validate({
      blogId: req.query.blogId,
      title: req.query.title,
    });
    if (error) {
      throw generateError(error.details, 422);
    }

    const { status, data } = await getBlogById({
      blogId: req.query.blogId,
      title: req.query.title,
    });
    if (status === "success") {
      res.status(200).send({
        message: "GET BLOG SUCCESSFULLY",
        data: data,
        success: true,
      });
    } else {
      next(data);
    }
  } catch (err) {
    next(err);
  }
};

export { createBlogService, updateBlogService, deleteBlogService, getBlogsService, getBlogByIdService, getBlogCountService };
