const Website = require("../../schemas/Website/WebsiteSchema");

async function listWebsites() {
  return Website.find({ isActive: true }).sort({ createdAt: -1 });
}

async function createWebsite({ name, key, domain }) {
  const website = new Website({ name, key, domain });
  return website.save();
}

async function updateWebsite(id, payload) {
  return Website.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
}

async function deleteWebsite(id) {
  return Website.findByIdAndDelete(id);
}

module.exports = { listWebsites, createWebsite, updateWebsite, deleteWebsite };
