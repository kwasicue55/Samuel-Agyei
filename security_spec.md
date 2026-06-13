# Security Specification: PrepMind AI Secure Firestore Architecture

## 1. Data Invariants

1. **Owner-Isolations (Data Privacy)**: No user may read, update, or delete any course kit, flashcard, quiz, quiz session, or socratic message that is owned by another user.
2. **Relational Veracity (No Orphaned Records)**: A flashcard or quiz question cannot exist without a valid parent `Kit` document whose `ownerId` matches the authenticated user and whose reference matches the path variables.
3. **Immutability of Key Identification (State Lock)**: Once a `Kit` or subcollection item is created, its `ownerId`, parent `document_id`/`kitId`, and `id` keys MUST remain immutable.
4. **Validation Integrity**: Values like `correct_option_index` must be non-negative integers bounded by the matching `options_array` size, and fields must have strict length bounds to prevent Resource Poisoning (Denial of Wallet).
5. **Verified Auth only**: All writes must require an authenticated session where `request.auth.token.email_verified == true`.

---

## 2. The "Dirty Dozen" Payloads (Attacks Matrix)

Here are twelve highly targeted JSON payloads designed to violate identity boundaries, state, or types, which our fortress rules will block:

### Attack 1: User Identity Spoofing in Kit Registration
* **Target Path**: `databases/{db}/documents/kits/malicious_kit_1`
* **Vulnerability Target**: Setting `ownerId` to a victim's UID.
* **Payload**:
  ```json
  {
    "id": "malicious_kit_1",
    "ownerId": "victim_user_abc_123",
    "title": "Hack Attack notes",
    "raw_text_content": "some text content",
    "upload_date": "2026-06-13",
    "quick_read_json": ["summary point"],
    "deep_dive_json": { "notes": [], "definitions": [] },
    "eli5_text": "analogy explanation"
  }
  ```
* **Expected Verdict**: `PERMISSION_DENIED` (UID mismatch check).

### Attack 2: Resource Poisoning via Over-sized Field String
* **Target Path**: `databases/{db}/documents/kits/oversized_kit_2`
* **Vulnerability Target**: Denially massive payload (Denial of Wallet).
* **Payload**:
  ```json
  {
    "id": "oversized_kit_2",
    "ownerId": "attacker_uid",
    "title": "[repeating A string 5,000 times]",
    "raw_text_content": "some text",
    "upload_date": "2026-06-13",
    "quick_read_json": [],
    "deep_dive_json": { "notes": [], "definitions": [] },
    "eli5_text": "analogy"
  }
  ```
* **Expected Verdict**: `PERMISSION_DENIED` (`title.size() <= 200` constraint).

### Attack 3: Shadow Update / Ghost Field Injection in User Document
* **Target Path**: `databases/{db}/documents/users/attacker_uid`
* **Vulnerability Target**: Spoofing isVerified/admin or billing subscription state.
* **Payload**:
  ```json
  {
    "id": "attacker_uid",
    "email": "attacker@gmail.com",
    "name": "Attacker Name",
    "subscription_status": "pro",
    "magic_unlimited_credits": true
  }
  ```
* **Expected Verdict**: `PERMISSION_DENIED` (`keys().size() == 4` check blocks Shadow Keys).

### Attack 4: Orphaned Record Creation (Falsified Kit ID)
* **Target Path**: `databases/{db}/documents/kits/non_existent_kit/flashcards/orphan_fc`
* **Vulnerability Target**: Creating cards pointing to a non-existent kit.
* **Payload**:
  ```json
  {
    "id": "orphan_fc",
    "document_id": "non_existent_kit",
    "question_text": "What?",
    "answer_text": "Nothin",
    "review_status": "learning",
    "ownerId": "attacker_uid"
  }
  ```
* **Expected Verdict**: `PERMISSION_DENIED` (existence validation on parent kit).

### Attack 5: Falsified Status Spoofing in Flashcard Update
* **Target Path**: `databases/{db}/documents/kits/kit_1/flashcards/fc_1`
* **Vulnerability Target**: Updating to an unlisted enum option like "super_mastered".
* **Payload**:
  ```json
  {
    "review_status": "super_mastered"
  }
  ```
* **Expected Verdict**: `PERMISSION_DENIED` (strict enum and `affectedKeys` validation).

### Attack 6: Cross-User Read Probe (Query Trust Bypass)
* **Target Path**: Reading `databases/{db}/documents/kits/victim_kit_abc`
* **Vulnerability Target**: Reading another user's content as a logged-in user.
* **Expected Verdict**: `PERMISSION_DENIED` (auth vs owner check).

### Attack 7: Modifying Immutable Origin Timestamp
* **Target Path**: Updating `databases/{db}/documents/kits/kit_1`
* **Payload**:
  ```json
  {
    "id": "kit_1",
    "ownerId": "attacker_uid",
    "title": "Updated Title",
    "raw_text_content": "updated content",
    "upload_date": "2026-06-13",
    "quick_read_json": ["summary"],
    "deep_dive_json": { "notes": [], "definitions": [] },
    "eli5_text": "analogy",
    "createdAt": "1999-01-01"
  }
  ```
* **Expected Verdict**: `PERMISSION_DENIED` (immutable createdAt enforcement).

### Attack 8: Self-Assigned Role Privilege Escalation
* **Target Path**: Creating standard profile with custom claims/arbitrary fields.
* **Payload**:
  ```json
  {
    "id": "attacker_uid",
    "role": "administrator",
    "email": "attacker@gmail.com",
    "name": "Attacker",
    "subscription_status": "pro"
  }
  ```
* **Expected Verdict**: `PERMISSION_DENIED` (profile key constraint blocks "role" key).

### Attack 9: Out-of-Bounds Option Index in Quiz Definition
* **Target Path**: `databases/{db}/documents/kits/kit_1/quizzes/quiz_1`
* **Vulnerability**: Correct index = -5 or 999 while only 3 options exist.
* **Payload**:
  ```json
  {
    "id": "quiz_1",
    "document_id": "kit_1",
    "question_text": "Equation?",
    "options_array": ["A", "B"],
    "correct_option_index": 999,
    "explanation": "test explanation",
    "ownerId": "attacker_uid"
  }
  ```
* **Expected Verdict**: `PERMISSION_DENIED` (`correct_option_index < options_array.size()`).

### Attack 10: Bot-Spammed Chat History Inundation
* **Target Path**: `databases/{db}/documents/kits/kit_1/messages/msg_spam`
* **Vulnerability**: Large spam strings.
* **Payload**:
  ```json
  {
    "id": "msg_spam",
    "role": "user",
    "text": "[string with 500kb content]",
    "timestamp": "12:00 PM"
  }
  ```
* **Expected Verdict**: `PERMISSION_DENIED` (`text.size() <= 2000`).

### Attack 11: Spoofed Verified-Email check with unverified session
* **Target Path**: Writing `databases/{db}/documents/kits/kit_1` with `email_verified == false`.
* **Expected Verdict**: `PERMISSION_DENIED`.

### Attack 12: Terminating State Loophole override
* **Target Path**: Tampering with completed quizSession scores to elevate stats illegally.
* **Payload**:
  ```json
  {
    "total": 5,
    "correct": 999
  }
  ```
* **Expected Verdict**: `PERMISSION_DENIED` (`correct <= total` check).

---

## 3. The Test Runner Reference

We configure `firestore.rules.test.ts` to execute locally against our emulator instance to assert these results before production. Production deployments require validation against these test cases.
