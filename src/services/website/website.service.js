const { listWebsites, createWebsite, updateWebsite, deleteWebsite } = require("../../repository/website/website.repository");

async function listWebsitesService(_req, res, next) {
  try {
    const websites = await listWebsites();
    return res.json({ message: "Websites fetched successfully", data: websites });
  } catch (error) {
    return next(error);
  }
}

async function createWebsiteService(req, res, next) {
  try {
    const website = await createWebsite(req.body);
    return res.status(201).json({ message: "Website created successfully", data: website });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "A website with this key already exists" });
    }
    return next(error);
  }
}

async function updateWebsiteService(req, res, next) {
  try {
    const website = await updateWebsite(req.params.id, req.body);
    if (!website) return res.status(404).json({ message: "Website not found" });
    return res.json({ message: "Website updated successfully", data: website });
  } catch (error) {
    return next(error);
  }
}

async function deleteWebsiteService(req, res, next) {
  try {
    const website = await deleteWebsite(req.params.id);
    if (!website) return res.status(404).json({ message: "Website not found" });
    return res.json({ message: "Website deleted successfully" });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listWebsitesService, createWebsiteService, updateWebsiteService, deleteWebsiteService };
