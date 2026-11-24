# Profile pictures: screenshots

Story B (issue #381). Every picture on these screens is a generated shape: a
diagonal gradient with one circle, drawn in a canvas by the script that took
the screenshots. There is no photo, no face and no file from a machine in any
of them. The data is "Synthetic demo data", and the people named are the demo
personas every stack has.

Each screen is taken twice, light and dark, from the Docker build of commit
`30cfa191` of `feat/area1-profile-pictures` (the review site, built with
`docker compose`, with the two-step and profile-picture migrations applied and
fresh synthetic data). The browser is the installed Microsoft Edge, headless,
with motion on. Desktop pictures are 1440 by 900 at 1x. The 390 px pictures are
a touch device, 390 by 844 at 2x.

| File (add `-light.png` or `-dark.png`) | What it shows                                                                                                                                                                                                                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account-card-empty`                   | Settings, Account, the Profile picture card for a person with no picture: initials, "Choose a picture", the demo note and the footnote.                                                                                                                                                             |
| `account-card-preview`                 | After a file is chosen: the 256 px square the browser made, "This is what the reviewer will see", and the one primary button, "Send for review".                                                                                                                                                    |
| `account-card-waiting`                 | After sending: "Waiting for review", who can see it, "No AI tool looked at it: the data rules do not allow that today", and the uploads left in the next 24 hours.                                                                                                                                  |
| `account-card-approved`                | After a reviewer approved it: the picture on the card, the date, and the Product manager's menu at the foot of the side panel drawing the same picture.                                                                                                                                             |
| `account-card-rejected`                | After a reviewer rejected it with a reason: the warning with the reason, the note that the picture was deleted, and "Choose a picture" again.                                                                                                                                                       |
| `side-panel-approved`                  | The side panel alone, 300 by 900: the approved picture replaces the initials in the account menu.                                                                                                                                                                                                   |
| `review-waiting`                       | Settings, Profile pictures, as the System admin: the waiting count beside the entry in the Settings list and on the Settings link in the side panel, the tabs with their count, and the first rows with the picture at large and avatar size, the owner, the time, the AI line, Approve and Reject. |
| `review-reject-dialog`                 | The reject dialog with the reason list and a reason chosen, over the list.                                                                                                                                                                                                                          |
| `review-empty`                         | The empty state once every waiting picture has been decided: "Nothing is waiting for review", and no count anywhere.                                                                                                                                                                                |
| `account-card-390`                     | The account card, waiting for review, on a 390 px touch screen.                                                                                                                                                                                                                                     |
| `review-list-390`                      | The review list on a 390 px touch screen: the tabs, the first row and its picture at large and avatar size.                                                                                                                                                                                         |

## How they were taken

A script signs in through the demo route (a fresh demo session per account),
and uses the real screens for what a person does: choosing a file, sending,
approving and rejecting. Other accounts' pictures are sent through the upload
route with the same abstract shapes, so the review list has rows. The remaining
waiting pictures are approved by the API at the end of a run to reach the empty
state. The review data is put back to the start before each pass and after the
last, so nothing from these runs is left on the site.

The scripts are kept with the working notes, not in the repository, because
they sign in to a local review site.
