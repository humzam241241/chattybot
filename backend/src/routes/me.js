const express = require('express');
const { userAuth } = require('../middleware/userAuth');

const router = express.Router();

router.get('/', userAuth, async (req, res) => {
  const appUser = req.user || null;
  return res.json({
    user: {
      id: req.user?.id || null,
      email: req.user?.email || null,
      is_admin: Boolean(req.user?.is_admin),
      subscription_status: appUser?.subscription_status || null,
      trial_ends_at: appUser?.trial_ends_at || null,
    },
  });
});

module.exports = router;

