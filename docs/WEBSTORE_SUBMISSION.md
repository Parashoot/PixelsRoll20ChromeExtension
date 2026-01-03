# Chrome Web Store Submission

This guide covers submitting the extension to the Chrome Web Store for official distribution.

## Prerequisites

- Chrome Developer Account ($5 one-time fee)
- `dist/` folder with built extension
- Extension icons and screenshots
- Privacy policy

## Account Setup

1. Go to [Chrome Web Store Developer Console](https://chromewebstore.google.com/webstore/devconsole)
2. Create developer account and pay $5
3. Verify your email address

## Submission Process

### Step 1: Upload Extension

1. Click "Create new item"
2. Click "Choose file" and select `dist/` folder (as ZIP)
3. Click "Upload"
4. You'll see a preview of your manifest and assets

### Step 2: Fill in Details

**Basic Info:**
- **Name:** Pixels Dice for Roll20
- **Short description:** Use Pixels Dice with Roll20
- **Long description:** 
  ```
  Connect your physical Pixels Dice to Roll20 and 
  automatically roll them in-game. Manage custom roll 
  templates, duplicate commands, and more.
  ```

**Category:** Games

**Language:** English

### Step 3: Graphics & Images

Upload these required assets:

**Icon (128x128 PNG):** `images/logo-64.png` (scale up to 128x128)
- Should be square with transparency
- Recognizable at small sizes

**Screenshots (1280x800 or 640x400 PNG):**
Need at least 2. Examples:
1. Extension popup showing dice list
2. Roll20 chat showing roll results

**Promotional Image (440x280 PNG):**
Optional but recommended for visibility

### Step 4: Permissions Justification

Chrome will ask why you need each permission. Answer:

**`storage`** - Stores custom roll templates and user preferences

**`scripting`** - Injects roll commands into Roll20's chat

**`tabs`** - Gets active Roll20 tab to send rolls

**`bluetooth`** - Connects to Pixels dice via Web Bluetooth

**`bluetoothPrivate`** - Required for Web Bluetooth in extensions

**`app.roll20.net` host permission** - Injects chat commands into Roll20

### Step 5: Privacy & Policies

**Privacy Policy:**
```
Pixels Dice for Roll20 does not collect, transmit, 
or store any user data. The extension:

- Connects locally via Bluetooth to Pixels dice
- Reads only the roll result value
- Injects commands into Roll20's chat
- Stores user preferences in Chrome's local storage
- Does not communicate with external servers
- Does not track usage or analytics
```

**Save this as privacy policy if you have a website, or note in submission**

### Step 6: Pricing

- Set to **Free**
- No in-app purchases

### Step 7: Review & Publish

1. Review all information
2. Accept terms and conditions
3. Submit for review

**Timeline:** Usually 1-3 days, sometimes 24 hours

## After Approval

Once approved:

1. Extension appears in Chrome Web Store
2. Users can install with one click
3. Updates happen automatically when you upload new versions
4. You can see installation stats and reviews

## Updating After Release

To release a new version:

1. Update `manifest.json` version number
2. Build: `npm run build`
3. Upload new version to Web Store
4. Update description/screenshots if needed
5. Submit for review

No need to reapply or pay again.

## Common Rejection Reasons

- **Missing privacy policy** - Required for all extensions
- **Unclear permissions** - Make sure you justify them
- **Misleading icons/screenshots** - Must accurately represent extension
- **Code issues** - Run through Chrome's extension validation
- **No description** - Provide clear, honest descriptions

## Tips for Success

✅ **Do:**
- Provide clear, honest descriptions
- Use professional icons and screenshots
- Explain why each permission is needed
- Test thoroughly before submission
- Respond quickly to reviewer questions
- Update regularly with improvements

❌ **Don't:**
- Mislead about functionality
- Request unnecessary permissions
- Copy descriptions from other extensions
- Include external links in descriptions
- Spam the store with updates

## Support & Troubleshooting

If rejected:
1. Read the rejection reason carefully
2. Fix the issue
3. Resubmit (no additional fee)

If you have questions:
- Check [Chrome Web Store Help](https://support.google.com/chrome_webstore/answer/1047213)
- Look at similar extensions for examples

## Example Timeline

```
Day 1: Submit extension
Day 1-2: Automated checks
Day 2-3: Manual review
Day 3: Approved! Extension goes live
```

After that, every update follows the same process.

---

**Ready to submit?** Use the checklist below:

- [ ] Extension builds successfully: `npm run build`
- [ ] Version updated in `manifest.json`
- [ ] Icon created (128x128 PNG)
- [ ] 2+ screenshots ready
- [ ] Privacy policy written
- [ ] Permissions justified
- [ ] Description finalized
- [ ] Developer account created ($5 paid)
- [ ] All files zipped and ready

Then proceed with submission!
