#!/usr/bin/env node
/**
 * Telegram notification hook - Wrapper for the notification system
 * Triggered on Stop events to notify via Telegram
 */
'use strict';

const path = require('path');

// Forward to the main notification router
require(path.join(__dirname, 'notifications', 'notify.cjs'));
