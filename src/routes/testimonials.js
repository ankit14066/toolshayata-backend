const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  createTestimonialService,
  deleteTestimonialService,
  listTestimonialsService,
  updateTestimonialService,
} = require("../services/testimonial/testimonial.service");

const router = express.Router();

router.get("/get", listTestimonialsService);
router.get("/", listTestimonialsService);
router.post("/create", requireAuth, requireRole("admin", "editor"), createTestimonialService);
router.post("/", requireAuth, requireRole("admin", "editor"), createTestimonialService);
router.put("/:id", requireAuth, requireRole("admin", "editor"), updateTestimonialService);
router.delete("/:id", requireAuth, requireRole("admin", "editor"), deleteTestimonialService);

module.exports = router;
