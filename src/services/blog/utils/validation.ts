import * as Joi from "joi";

const customMessages = {
  "string.empty": "{#label} is required",
  "any.required": "{#label} is required",
  "string.min": "{#label} should be at least {#limit} characters",
  "string.max": "{#label} should be at most {#limit} characters",
  "number.min": "{#label} should be at least {#limit}",
  "number.max": "{#label} should be at most {#limit}",
  "array.min": "{#label} should have at least {#limit} items",
  "array.max": "{#label} should not be greatuer than {#limit} items",
};

const createBlogValidation = Joi.object({
  subTitle : Joi.string().trim().messages(customMessages),
  slug : Joi.string().trim().messages(customMessages),
  category : Joi.string().trim().messages(customMessages),
  isPrivate : Joi.valid(true,false),
  coverImage: Joi.any().messages(customMessages),
  title: Joi.string().trim().min(3).required().messages(customMessages),
  content: Joi.string().trim().messages(customMessages),
  company : Joi.string().trim().required().messages(customMessages),
  tags: Joi.array().messages(customMessages),
  status: Joi.valid("published", "draft").optional().messages(customMessages),
}).options({
  abortEarly: false
});

const getBlogByIdValidation = Joi.object({
  blogId: Joi.string().trim().messages(customMessages),
  title: Joi.string().trim().messages(customMessages),
}).options({
  abortEarly: false,
});
export { createBlogValidation, getBlogByIdValidation };
